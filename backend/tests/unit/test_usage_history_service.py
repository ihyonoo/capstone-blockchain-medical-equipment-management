"""usage_history_service의 순수 로직 + subprocess 오케스트레이션 단위 테스트.

DB I/O가 필요한 fetch_usage_record_for_chain/persist_usage_chain_anchor_metadata는
integration/test_usage_history_service.py 에서 다룬다. 여기서는 그 둘을 monkeypatch로
치환해 진짜 DB/Node 프로세스가 절대 실행되지 않게 한다.
"""

import json
import subprocess

import pytest

from backend import usage_history_service as svc


class TestIsBesuReady:
    def test_ready_when_deployment_and_node_modules_exist(self, tmp_path, monkeypatch):
        besu_dir = tmp_path / "besu"
        (besu_dir / "node_modules").mkdir(parents=True)
        deployment_path = besu_dir / "deployments" / "usage-registry.json"
        deployment_path.parent.mkdir(parents=True)
        deployment_path.write_text("{}")
        monkeypatch.setattr(svc, "BESU_DIR", besu_dir)
        monkeypatch.setattr(svc, "BESU_DEPLOYMENT_PATH", deployment_path)

        ready, reason = svc.is_besu_ready()

        assert ready is True
        assert reason is None

    def test_not_ready_when_deployment_file_missing(self, tmp_path, monkeypatch):
        besu_dir = tmp_path / "besu"
        (besu_dir / "node_modules").mkdir(parents=True)
        monkeypatch.setattr(svc, "BESU_DIR", besu_dir)
        monkeypatch.setattr(svc, "BESU_DEPLOYMENT_PATH", besu_dir / "deployments" / "usage-registry.json")

        ready, reason = svc.is_besu_ready()

        assert ready is False
        assert reason is not None

    def test_not_ready_when_node_modules_missing(self, tmp_path, monkeypatch):
        besu_dir = tmp_path / "besu"
        besu_dir.mkdir()
        deployment_path = besu_dir / "deployments" / "usage-registry.json"
        deployment_path.parent.mkdir(parents=True)
        deployment_path.write_text("{}")
        monkeypatch.setattr(svc, "BESU_DIR", besu_dir)
        monkeypatch.setattr(svc, "BESU_DEPLOYMENT_PATH", deployment_path)

        ready, reason = svc.is_besu_ready()

        assert ready is False
        assert reason is not None


class TestRunBesuScript:
    def test_invokes_node_with_expected_command_and_cwd(self, monkeypatch):
        captured = {}

        def fake_run(cmd, **kwargs):
            captured["cmd"] = cmd
            captured["kwargs"] = kwargs
            return subprocess.CompletedProcess(cmd, 0, stdout="ok\n", stderr="")

        monkeypatch.setattr(svc.subprocess, "run", fake_run)

        ok, stdout, stderr = svc.run_besu_script("read-usage-record.mjs", "123")

        assert ok is True
        assert stdout == "ok"
        assert stderr == ""
        assert captured["cmd"] == ["node", "scripts/read-usage-record.mjs", "123"]
        assert captured["kwargs"]["cwd"] == svc.BESU_DIR
        assert captured["kwargs"]["timeout"] == 30
        assert captured["kwargs"]["capture_output"] is True

    def test_returns_false_on_nonzero_exit_code(self, monkeypatch):
        monkeypatch.setattr(
            svc.subprocess,
            "run",
            lambda cmd, **kwargs: subprocess.CompletedProcess(cmd, 1, stdout="", stderr="boom"),
        )

        ok, stdout, stderr = svc.run_besu_script("record-usage-record.mjs", "{}")

        assert ok is False
        assert stderr == "boom"

    def test_timeout_propagates_uncaught(self, monkeypatch):
        # run_besu_script는 TimeoutExpired를 잡지 않는다 - 상위 호출자도 마찬가지라
        # 실제 서브프로세스가 30초 타임아웃에 걸리면 "우아한 저하"가 깨지고 예외가 그대로
        # server.py까지 전파된다. 의심스러운 동작이라 회귀 감지용으로 남겨둔다.
        def fake_run(cmd, **kwargs):
            raise subprocess.TimeoutExpired(cmd, 30)

        monkeypatch.setattr(svc.subprocess, "run", fake_run)

        with pytest.raises(subprocess.TimeoutExpired):
            svc.run_besu_script("read-usage-record.mjs", "123")


class TestReadUsageRecordFromChain:
    def test_not_configured_when_besu_not_ready(self, monkeypatch):
        monkeypatch.setattr(svc, "is_besu_ready", lambda: (False, "이유"))
        calls = []
        monkeypatch.setattr(svc, "run_besu_script", lambda *a, **k: calls.append(a) or (True, "{}", ""))

        result = svc.read_usage_record_from_chain(1)

        assert result["status"] == "not_configured"
        assert result["exists"] is False
        assert calls == []

    def test_read_error_when_script_fails(self, monkeypatch):
        monkeypatch.setattr(svc, "is_besu_ready", lambda: (True, None))
        monkeypatch.setattr(svc, "run_besu_script", lambda *a, **k: (False, "", "node error"))

        result = svc.read_usage_record_from_chain(1)

        assert result["status"] == "read_error"
        assert result["detail"] == "node error"
        assert result["exists"] is False

    def test_read_error_on_invalid_json(self, monkeypatch):
        monkeypatch.setattr(svc, "is_besu_ready", lambda: (True, None))
        monkeypatch.setattr(svc, "run_besu_script", lambda *a, **k: (True, "not-json", ""))

        result = svc.read_usage_record_from_chain(1)

        assert result["status"] == "read_error"

    def test_ok_when_script_succeeds(self, monkeypatch):
        monkeypatch.setattr(svc, "is_besu_ready", lambda: (True, None))
        payload = {"exists": True, "usageId": "1"}
        monkeypatch.setattr(svc, "run_besu_script", lambda *a, **k: (True, json.dumps(payload), ""))

        result = svc.read_usage_record_from_chain(1)

        assert result["status"] == "ok"
        assert result["exists"] is True
        assert result["record"] == payload


class TestUsageRecordMatchesChain:
    def test_matches_when_all_comparable_fields_equal(self):
        record = {
            "usageId": "1",
            "checkoutUserId": 1,
            "returnUserId": 2,
            "tagId": "t",
            "checkoutLocation": "a",
            "checkoutAt": 1,
            "returnLocation": "b",
            "returnedAt": 2,
        }

        assert svc.usage_record_matches_chain(record, dict(record)) is True

    def test_mismatch_when_a_field_differs(self):
        expected = {"usageId": "1", "tagId": "t"}
        actual = {"usageId": "1", "tagId": "other"}

        assert svc.usage_record_matches_chain(expected, actual) is False


def _payload(**overrides):
    base = {
        "usageId": "1",
        "checkoutUserId": 1,
        "returnUserId": 2,
        "tagId": "TAG-1",
        "checkoutLocation": "수술실",
        "checkoutAt": 1_700_000_000,
        "returnLocation": "영상의학과",
        "returnedAt": 1_700_003_600,
    }
    base.update(overrides)
    return base


class TestAnchorUsageRecordToChain:
    def test_not_configured_when_besu_not_ready_and_no_io_happens(self, monkeypatch):
        monkeypatch.setattr(svc, "is_besu_ready", lambda: (False, "이유"))
        fetch_calls = []
        run_calls = []
        monkeypatch.setattr(svc, "fetch_usage_record_for_chain", lambda uid: fetch_calls.append(uid))
        monkeypatch.setattr(svc, "run_besu_script", lambda *a, **k: run_calls.append(a) or (True, "{}", ""))

        result = svc.anchor_usage_record_to_chain(1)

        assert result == {"ok": False, "status": "not_configured", "detail": "이유"}
        assert fetch_calls == []
        assert run_calls == []

    def test_missing_usage_when_fetch_returns_none(self, monkeypatch):
        monkeypatch.setattr(svc, "is_besu_ready", lambda: (True, None))
        monkeypatch.setattr(svc, "fetch_usage_record_for_chain", lambda uid: None)

        result = svc.anchor_usage_record_to_chain(1)

        assert result["ok"] is False
        assert result["status"] == "missing_usage"

    def test_already_anchored_when_onchain_record_matches(self, monkeypatch):
        payload = _payload()
        monkeypatch.setattr(svc, "is_besu_ready", lambda: (True, None))
        monkeypatch.setattr(svc, "fetch_usage_record_for_chain", lambda uid: dict(payload))
        monkeypatch.setattr(
            svc,
            "read_usage_record_from_chain",
            lambda uid: {"status": "ok", "exists": True, "record": dict(payload)},
        )
        run_calls = []
        monkeypatch.setattr(svc, "run_besu_script", lambda *a, **k: run_calls.append(a) or (True, "{}", ""))

        result = svc.anchor_usage_record_to_chain(1)

        assert result["ok"] is True
        assert result["status"] == "already_anchored"
        assert run_calls == []  # 이미 온체인에 있으므로 기록 스크립트를 재호출하면 안 된다

    def test_mismatch_when_onchain_record_differs(self, monkeypatch):
        payload = _payload()
        onchain = _payload(tagId="다른-태그")
        monkeypatch.setattr(svc, "is_besu_ready", lambda: (True, None))
        monkeypatch.setattr(svc, "fetch_usage_record_for_chain", lambda uid: dict(payload))
        monkeypatch.setattr(
            svc,
            "read_usage_record_from_chain",
            lambda uid: {"status": "ok", "exists": True, "record": onchain},
        )

        result = svc.anchor_usage_record_to_chain(1)

        assert result["ok"] is False
        assert result["status"] == "mismatch"
        assert result["record"] == onchain

    def test_anchors_successfully_when_not_yet_onchain(self, monkeypatch):
        payload = _payload()
        chain_result = {
            "txHash": "0xabc",
            "blockNumber": 5,
            "blockHash": "0xblock",
            "transactionIndex": 0,
            "recordedAt": 1_700_003_601,
        }
        monkeypatch.setattr(svc, "is_besu_ready", lambda: (True, None))
        monkeypatch.setattr(svc, "fetch_usage_record_for_chain", lambda uid: dict(payload))
        monkeypatch.setattr(
            svc,
            "read_usage_record_from_chain",
            lambda uid: {"status": "not_configured", "exists": False, "detail": None},
        )
        recorded = []

        def fake_run(script_name, *args):
            recorded.append((script_name, args))
            return True, json.dumps(chain_result), ""

        monkeypatch.setattr(svc, "run_besu_script", fake_run)

        result = svc.anchor_usage_record_to_chain(1)

        assert result["ok"] is True
        assert result["status"] == "anchored"
        assert result["transaction_hash"] == "0xabc"
        assert result["block_number"] == 5
        assert recorded[0][0] == "record-usage-record.mjs"
        assert json.loads(recorded[0][1][0]) == payload

    def test_record_error_when_script_fails(self, monkeypatch):
        payload = _payload()
        monkeypatch.setattr(svc, "is_besu_ready", lambda: (True, None))
        monkeypatch.setattr(svc, "fetch_usage_record_for_chain", lambda uid: dict(payload))
        monkeypatch.setattr(
            svc,
            "read_usage_record_from_chain",
            lambda uid: {"status": "not_configured", "exists": False, "detail": None},
        )
        monkeypatch.setattr(svc, "run_besu_script", lambda *a, **k: (False, "", "revert"))

        result = svc.anchor_usage_record_to_chain(1)

        assert result["ok"] is False
        assert result["status"] == "record_error"
        assert result["detail"] == "revert"

    def test_record_error_on_invalid_json_response(self, monkeypatch):
        payload = _payload()
        monkeypatch.setattr(svc, "is_besu_ready", lambda: (True, None))
        monkeypatch.setattr(svc, "fetch_usage_record_for_chain", lambda uid: dict(payload))
        monkeypatch.setattr(
            svc,
            "read_usage_record_from_chain",
            lambda uid: {"status": "not_configured", "exists": False, "detail": None},
        )
        monkeypatch.setattr(svc, "run_besu_script", lambda *a, **k: (True, "not-json", ""))

        result = svc.anchor_usage_record_to_chain(1)

        assert result["ok"] is False
        assert result["status"] == "record_error"


class TestVerifyUsageHistoryIntegrity:
    def test_not_ready_degrades_without_subprocess_call(self, monkeypatch):
        monkeypatch.setattr(svc, "is_besu_ready", lambda: (False, "이유"))
        calls = []
        monkeypatch.setattr(svc, "run_besu_script", lambda *a, **k: calls.append(a) or (True, "{}", ""))
        rows = [(1, "returned") + (None,) * 23]

        results, summary = svc.verify_usage_history_integrity(rows)

        assert calls == []
        assert results[1]["verification_status"] == "not_configured"
        assert summary["failed_count"] == 1
        assert summary["not_eligible_count"] == 0

    def test_not_eligible_rows_skip_chain_check(self, monkeypatch):
        monkeypatch.setattr(svc, "is_besu_ready", lambda: (True, None))
        calls = []

        def fake_run(*a, **k):
            calls.append(a)
            return True, json.dumps({"items": [], "summary": {}}), ""

        monkeypatch.setattr(svc, "run_besu_script", fake_run)
        rows = [(1, "checked_out") + (None,) * 23]

        results, _summary = svc.verify_usage_history_integrity(rows)

        assert results[1]["verification_status"] == "not_eligible"
        assert results[1]["eligible"] is False
        assert len(calls) == 1  # not_eligible 이어도 스크립트 자체는 한 번 호출된다


class TestBuildUsageHistoryVerificationRequest:
    def test_expected_is_none_when_not_returned(self):
        row = (1, "checked_out") + (None,) * 23

        result = svc.build_usage_history_verification_request(row)

        assert result["expected"] is None
        assert result["usageStatus"] == "checked_out"

    def test_builds_expected_payload_when_returned(self):
        row = [None] * 25
        row[0] = 1
        row[1] = "returned"
        row[2] = 10  # user_id
        row[6] = 20  # returned_by_user_id
        row[10] = "TAG-1"
        row[14] = "수술실"
        row[15] = 1_700_000_000
        row[17] = "영상의학과"
        row[18] = 1_700_003_600

        result = svc.build_usage_history_verification_request(tuple(row))

        assert result["expected"]["usageId"] == "1"
        assert result["expected"]["checkoutUserId"] == 10
        assert result["expected"]["returnUserId"] == 20
        assert result["expected"]["tagId"] == "TAG-1"

import json

import pytest
from fastapi import HTTPException

from backend import demo_history
from backend.demo_history import (
    build_blockchain_demo_history,
    build_demo_recalculated_merkle_root,
    get_demo_equipment_profile,
    get_demo_user_profile,
    load_blockchain_demo_history_payload,
    parse_demo_int,
)

# BLOCKCHAIN_DEMO_USERS/EQUIPMENT에 실제로 등록돼 있는 값들
KNOWN_USER_ID = 2407714
KNOWN_USER_NAME = "윤태성"
KNOWN_TAG_ID = "BME-24-003117"
KNOWN_TAG_NAME = "제세동기"


class TestParseDemoInt:
    def test_int_passthrough(self):
        assert parse_demo_int(42) == 42

    def test_numeric_string(self):
        assert parse_demo_int("42") == 42

    def test_unparseable_string(self):
        assert parse_demo_int("not-a-number") is None

    def test_none(self):
        assert parse_demo_int(None) is None

    def test_other_type(self):
        assert parse_demo_int([1, 2]) is None


class TestGetDemoUserProfile:
    def test_known_user_id(self):
        profile = get_demo_user_profile(KNOWN_USER_ID)
        assert profile["user_id"] == KNOWN_USER_ID
        assert profile["name"] == KNOWN_USER_NAME
        assert profile["department"] != "-"
        assert profile["position"] != "-"

    def test_unknown_user_id_falls_back(self):
        profile = get_demo_user_profile(999999)
        assert profile["user_id"] == 999999
        assert profile["name"] == "직원 999999"
        assert profile["department"] == "-"
        assert profile["position"] == "-"

    def test_none_user_id_fills_dashes(self):
        profile = get_demo_user_profile(None)
        assert profile == {
            "user_id": None,
            "name": "-",
            "department": "-",
            "position": "-",
        }


class TestGetDemoEquipmentProfile:
    def test_known_tag_id(self):
        profile = get_demo_equipment_profile(KNOWN_TAG_ID)
        assert profile["tag_id"] == KNOWN_TAG_ID
        assert profile["name"] == KNOWN_TAG_NAME
        assert profile["type"] is not None

    def test_unknown_tag_id_falls_back_to_tag_id_as_name(self):
        profile = get_demo_equipment_profile("UNKNOWN-TAG-999")
        assert profile == {
            "tag_id": "UNKNOWN-TAG-999",
            "name": "UNKNOWN-TAG-999",
            "type": None,
        }

    def test_none_tag_id_is_unidentified(self):
        assert get_demo_equipment_profile(None) == {
            "tag_id": "-",
            "name": "미상 장비",
            "type": None,
        }

    def test_empty_string_tag_id_is_unidentified(self):
        assert get_demo_equipment_profile("") == {
            "tag_id": "-",
            "name": "미상 장비",
            "type": None,
        }


class TestBuildDemoRecalculatedMerkleRoot:
    def test_should_fail_false_returns_original(self):
        root = build_demo_recalculated_merkle_root("0xabc123", should_fail=False)
        assert root == "0xabc123"

    def test_should_fail_true_returns_tampered_value(self):
        root = build_demo_recalculated_merkle_root("0xabc123", should_fail=True)
        assert root != "0xabc123"
        assert root.startswith("0x")

    def test_recorded_merkle_root_none_stays_none(self):
        assert build_demo_recalculated_merkle_root(None, should_fail=False) is None
        assert build_demo_recalculated_merkle_root(None, should_fail=True) is None

    def test_recorded_merkle_root_empty_string_stays_none(self):
        assert build_demo_recalculated_merkle_root("", should_fail=True) is None


def _make_tx(
    transaction_index,
    usage_id="U1",
    checkout_user_id=KNOWN_USER_ID,
    return_user_id=None,
    tag_id=KNOWN_TAG_ID,
):
    return {
        "transactionIndex": transaction_index,
        "hash": f"0xtx{transaction_index}",
        "input": {
            "args": {
                "usageId": usage_id,
                "checkoutUserId": checkout_user_id,
                "returnUserId": return_user_id,
                "tagId": tag_id,
                "checkoutLocation": "응급실",
                "returnLocation": "응급실",
                "checkoutAt": 1000,
                "returnedAt": 2000,
            }
        },
    }


def _make_block(batch_index, number, timestamp_epoch, transactions):
    return {
        "batchIndex": batch_index,
        "header": {
            "number": number,
            "hash": f"0xblock{number}",
            "timestamp": {"epoch": timestamp_epoch},
            "transactionsRoot": f"0xroot{number}",
            "receiptsRoot": f"0xreceipts{number}",
            "stateRoot": f"0xstate{number}",
            # transactionCount 일부러 생략 -> len(transactions)로 폴백하는지 확인
        },
        "body": {"transactions": transactions},
    }


class TestLoadBlockchainDemoHistoryPayload:
    def test_missing_file_raises_500(self, tmp_path, monkeypatch):
        missing_path = tmp_path / "does-not-exist.json"
        monkeypatch.setattr(demo_history, "BLOCKCHAIN_DEMO_BLOCKS_PATH", missing_path)
        with pytest.raises(HTTPException) as exc:
            load_blockchain_demo_history_payload()
        assert exc.value.status_code == 500

    def test_invalid_json_raises_500(self, tmp_path, monkeypatch):
        bad_file = tmp_path / "bad.json"
        bad_file.write_text("{not valid json,", encoding="utf-8")
        monkeypatch.setattr(demo_history, "BLOCKCHAIN_DEMO_BLOCKS_PATH", bad_file)
        with pytest.raises(HTTPException) as exc:
            load_blockchain_demo_history_payload()
        assert exc.value.status_code == 500

    def test_wrong_shape_raises_500(self, tmp_path, monkeypatch):
        wrong_shape_file = tmp_path / "wrong-shape.json"
        wrong_shape_file.write_text(json.dumps({"blocks": "not-a-list"}), encoding="utf-8")
        monkeypatch.setattr(demo_history, "BLOCKCHAIN_DEMO_BLOCKS_PATH", wrong_shape_file)
        with pytest.raises(HTTPException) as exc:
            load_blockchain_demo_history_payload()
        assert exc.value.status_code == 500

    def test_valid_file_returns_parsed_payload(self, tmp_path, monkeypatch):
        payload = {"blocks": [_make_block(0, 100, 1000, [_make_tx(0)])]}
        valid_file = tmp_path / "valid.json"
        valid_file.write_text(json.dumps(payload), encoding="utf-8")
        monkeypatch.setattr(demo_history, "BLOCKCHAIN_DEMO_BLOCKS_PATH", valid_file)
        assert load_blockchain_demo_history_payload() == payload


class TestBuildBlockchainDemoHistory:
    def _write_payload(self, tmp_path, monkeypatch, blocks, failed_block_index=1, failed_tx_index=1):
        demo_file = tmp_path / "demo-blocks.json"
        demo_file.write_text(json.dumps({"blocks": blocks}), encoding="utf-8")
        monkeypatch.setattr(demo_history, "BLOCKCHAIN_DEMO_BLOCKS_PATH", demo_file)
        monkeypatch.setattr(demo_history, "BLOCKCHAIN_DEMO_FAILED_BLOCK_INDEX", failed_block_index)
        monkeypatch.setattr(demo_history, "BLOCKCHAIN_DEMO_FAILED_TRANSACTION_INDEX", failed_tx_index)

    def test_marks_matching_block_and_tx_index_as_failed(self, tmp_path, monkeypatch):
        # block1의 transactionIndex=1인 트랜잭션만 failed_block/failed_tx 인덱스와 일치
        block0 = _make_block(0, 100, 1000, [_make_tx(0)])
        block1 = _make_block(
            1,
            101,
            2000,
            [_make_tx(0, usage_id="U2"), _make_tx(1, usage_id="U3")],
        )
        # payload 안에서는 일부러 뒤섞어서 넣어 정렬 로직도 함께 확인
        self._write_payload(tmp_path, monkeypatch, [block1, block0], failed_block_index=1, failed_tx_index=1)

        result = build_blockchain_demo_history()

        assert result["ok"] is True
        assert result["count"] == 3
        assert len(result["blocks"]) == 2
        assert len(result["items"]) == 3

        # block_number 오름차순으로 정렬돼야 한다 (100번대 블록이 먼저)
        block_numbers = [item["blockchain"]["block_number"] for item in result["items"]]
        assert block_numbers == sorted(block_numbers)

        statuses_by_usage_id = {item["usage_id"]: item["blockchain"]["verification_status"] for item in result["items"]}
        assert statuses_by_usage_id["U1"] == "verified"
        assert statuses_by_usage_id["U2"] == "verified"
        assert statuses_by_usage_id["U3"] == "failed"

        assert result["integrity_summary"] == {
            "verified_count": 2,
            "block_count": 2,
            "transaction_count": 3,
        }

    def test_transaction_count_falls_back_to_len_when_missing(self, tmp_path, monkeypatch):
        block0 = _make_block(0, 100, 1000, [_make_tx(0), _make_tx(1)])
        self._write_payload(tmp_path, monkeypatch, [block0], failed_block_index=99, failed_tx_index=99)

        result = build_blockchain_demo_history()

        assert result["blocks"][0]["transaction_count"] == 2

    def test_item_carries_user_and_equipment_profiles(self, tmp_path, monkeypatch):
        block0 = _make_block(
            0,
            100,
            1000,
            [_make_tx(0, checkout_user_id=KNOWN_USER_ID, return_user_id=None, tag_id=KNOWN_TAG_ID)],
        )
        self._write_payload(tmp_path, monkeypatch, [block0], failed_block_index=99, failed_tx_index=99)

        result = build_blockchain_demo_history()
        item = result["items"][0]

        assert item["user"]["name"] == KNOWN_USER_NAME
        assert item["returned_by"]["name"] == "-"
        assert item["equipment"]["name"] == KNOWN_TAG_NAME

    def test_propagates_500_when_file_missing(self, tmp_path, monkeypatch):
        monkeypatch.setattr(demo_history, "BLOCKCHAIN_DEMO_BLOCKS_PATH", tmp_path / "missing.json")
        with pytest.raises(HTTPException) as exc:
            build_blockchain_demo_history()
        assert exc.value.status_code == 500

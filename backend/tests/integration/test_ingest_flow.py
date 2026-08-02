"""HYST_DB(히스테리시스)/DWELL_SEC(체류)로 위치 판정 플래핑을 막는 /ingest 로직 통합 테스트.

backend/settings.py 기준 HYST_DB=8, DWELL_SEC=2, STALE_SEC=5.
"""

from backend.server import tag_state


def _post_ingest(client, monkeypatch, *, now, reader_id, tag_id, rssi):
    monkeypatch.setattr("backend.server.time.time", lambda: float(now))
    response = client.post(
        "/ingest",
        json={
            "reader_id": reader_id,
            "ts": now,
            "observations": [{"tag_id": tag_id, "rssi": rssi, "count": 1, "last_seen": now}],
        },
    )
    assert response.status_code == 200
    return response


class TestIngestHysteresisAndDwell:
    def test_first_observation_sets_current_reader_immediately(self, client, seed_tag, monkeypatch):
        tag_id = seed_tag()

        _post_ingest(client, monkeypatch, now=0, reader_id="M503", tag_id=tag_id, rssi=-60)

        assert tag_state[tag_id]["current_reader"] == "M503"

    def test_small_rssi_difference_does_not_switch_reader(self, client, seed_tag, monkeypatch):
        tag_id = seed_tag()
        _post_ingest(client, monkeypatch, now=0, reader_id="M503", tag_id=tag_id, rssi=-60)

        # M504가 5dB 더 강하지만 HYST_DB(8dB)를 넘지 못해 전환되면 안 된다.
        _post_ingest(client, monkeypatch, now=1, reader_id="M504", tag_id=tag_id, rssi=-55)

        assert tag_state[tag_id]["current_reader"] == "M503"
        assert tag_state[tag_id]["candidate_reader"] is None

    def test_switches_only_after_hysteresis_and_dwell_both_satisfied(self, client, seed_tag, monkeypatch):
        tag_id = seed_tag()
        _post_ingest(client, monkeypatch, now=0, reader_id="M503", tag_id=tag_id, rssi=-60)

        # HYST_DB(8dB)는 넘지만(10dB 차이) DWELL_SEC(2초)가 아직 지나지 않아 후보로만 등록된다.
        _post_ingest(client, monkeypatch, now=2, reader_id="M504", tag_id=tag_id, rssi=-50)
        assert tag_state[tag_id]["current_reader"] == "M503"
        assert tag_state[tag_id]["candidate_reader"] == "M504"

        # DWELL_SEC(2초) 이상 같은 후보가 유지되면 그제서야 전환된다.
        _post_ingest(client, monkeypatch, now=4, reader_id="M504", tag_id=tag_id, rssi=-50)
        assert tag_state[tag_id]["current_reader"] == "M504"
        assert tag_state[tag_id]["candidate_reader"] is None

    def test_candidate_resets_if_signal_drops_back_below_hysteresis(self, client, seed_tag, monkeypatch):
        tag_id = seed_tag()
        _post_ingest(client, monkeypatch, now=0, reader_id="M503", tag_id=tag_id, rssi=-60)
        _post_ingest(client, monkeypatch, now=1, reader_id="M504", tag_id=tag_id, rssi=-50)
        assert tag_state[tag_id]["candidate_reader"] == "M504"

        # M504 신호가 다시 약해져 히스테리시스를 못 넘기면 후보에서 빠져야 한다.
        _post_ingest(client, monkeypatch, now=2, reader_id="M504", tag_id=tag_id, rssi=-56)

        assert tag_state[tag_id]["current_reader"] == "M503"
        assert tag_state[tag_id]["candidate_reader"] is None

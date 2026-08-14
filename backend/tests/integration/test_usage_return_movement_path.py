"""반납 시 usage_history.movement_path가 tag_state_history로부터 계산·저장되는지 검증한다.

checkout_at~returned_at 구간에 있는 tag_state_history 행만 시간순으로 담기고,
그 구간 밖의 행은 제외되어야 한다.
"""

import datetime as dt
import time


def _checkout(client, headers, nfc_token):
    return client.post("/usage/checkout", json={"nfc_token": nfc_token}, headers=headers)


def _return(client, headers, nfc_token):
    return client.post("/usage/return", json={"nfc_token": nfc_token}, headers=headers)


def _fetch_checkout_at(db_conn, tag_id):
    with db_conn.cursor() as cur:
        cur.execute("SELECT checkout_at FROM usage_history WHERE tag_id = %s", (tag_id,))
        (checkout_at,) = cur.fetchone()
    return checkout_at


def _insert_tag_state(db_conn, *, tag_id, reader_id, decided_at):
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO tag_state_history (tag_id, reader_id, rssi, decided_at) VALUES (%s, %s, %s, %s)",
            (tag_id, reader_id, -55, decided_at),
        )
    db_conn.commit()


def _fetch_movement_path(db_conn, tag_id):
    with db_conn.cursor() as cur:
        cur.execute("SELECT movement_path FROM usage_history WHERE tag_id = %s", (tag_id,))
        (movement_path,) = cur.fetchone()
    return movement_path


class TestReturnMovementPath:
    def test_persists_intermediate_movements_in_order(self, client, seed_tag, seed_user, seed_reader, db_conn):
        tag_id = seed_tag(nfc_tag_uid="NFC-040")
        _user_id, headers = seed_user(username="mover")
        seed_reader(reader_id="M701", location_name="수술실")
        seed_reader(reader_id="M702", location_name="회복실")

        assert _checkout(client, headers, "NFC-040").status_code == 200
        checkout_at = _fetch_checkout_at(db_conn, tag_id)

        # 체크아웃 이전 관측치는 경로에서 제외되어야 한다.
        _insert_tag_state(db_conn, tag_id=tag_id, reader_id="M701", decided_at=checkout_at - dt.timedelta(seconds=5))
        # 체크아웃 이후 실제로 거쳐간 두 지점.
        _insert_tag_state(db_conn, tag_id=tag_id, reader_id="M701", decided_at=checkout_at + dt.timedelta(seconds=1))
        _insert_tag_state(db_conn, tag_id=tag_id, reader_id="M702", decided_at=checkout_at + dt.timedelta(seconds=2))

        # 반납 시점(now())이 위 관측치들보다 뒤여야 구간에 포함된다.
        time.sleep(3)

        response = _return(client, headers, "NFC-040")
        assert response.status_code == 200

        movement_path = _fetch_movement_path(db_conn, tag_id)
        assert [point["location"] for point in movement_path] == ["수술실", "회복실"]
        assert movement_path[0]["at"] < movement_path[1]["at"]

    def test_empty_when_no_intermediate_movement(self, client, seed_tag, seed_user, db_conn):
        tag_id = seed_tag(nfc_tag_uid="NFC-041")
        _user_id, headers = seed_user(username="stationary")

        assert _checkout(client, headers, "NFC-041").status_code == 200
        response = _return(client, headers, "NFC-041")
        assert response.status_code == 200

        assert _fetch_movement_path(db_conn, tag_id) == []

"""/usage/checkout, /usage/return 상태 전이 통합 테스트.

tags.asset_status(available <-> checked_out)와 usage_history 행이
NFC 체크아웃/반납 흐름을 따라 정확히 열리고 닫히는지 검증한다.
"""


class TestCheckout:
    def test_checkout_marks_tag_checked_out(self, client, seed_tag, seed_user, db_conn, checkout):
        tag_id = seed_tag(nfc_token="NFC-001")
        _user_id, headers = seed_user()

        response = checkout("NFC-001", headers)

        assert response.status_code == 200
        assert response.json()["ok"] is True

        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT asset_status, current_holder_user_id, current_usage_id FROM tags WHERE tag_id = %s",
                (tag_id,),
            )
            asset_status, holder_id, usage_id = cur.fetchone()
        assert asset_status == "checked_out"
        assert holder_id == _user_id
        assert usage_id is not None

    def test_checkout_rejects_already_checked_out_tag(self, client, seed_tag, seed_user, checkout):
        seed_tag(nfc_token="NFC-002")
        _user_id, headers = seed_user()
        checkout("NFC-002", headers)

        response = checkout("NFC-002", headers)

        assert response.status_code == 409

    def test_checkout_rejects_unauthenticated_request(self, client, seed_tag):
        seed_tag(nfc_token="NFC-003")

        response = client.post("/usage/checkout", json={"nfc_token": "NFC-003"})

        assert response.status_code == 401


class TestReturn:
    def test_return_by_holder_marks_tag_available(
        self, client, seed_tag, seed_user, db_conn, checkout, return_equipment
    ):
        tag_id = seed_tag(nfc_token="NFC-010")
        user_id, headers = seed_user(username="holder")
        checkout("NFC-010", headers)

        response = return_equipment("NFC-010", headers)

        assert response.status_code == 200
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT asset_status, current_holder_user_id, current_usage_id FROM tags WHERE tag_id = %s",
                (tag_id,),
            )
            asset_status, holder_id, usage_id = cur.fetchone()
        assert asset_status == "available"
        assert holder_id is None
        assert usage_id is None

        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT usage_status, returned_by_user_id FROM usage_history WHERE tag_id = %s",
                (tag_id,),
            )
            usage_status, returned_by = cur.fetchone()
        assert usage_status == "returned"
        assert returned_by == user_id

    def test_return_rejects_when_not_checked_out(self, client, seed_tag, seed_user, return_equipment):
        seed_tag(nfc_token="NFC-011")
        _user_id, headers = seed_user()

        response = return_equipment("NFC-011", headers)

        assert response.status_code == 409

    def test_return_by_other_staff_is_allowed(self, client, seed_tag, seed_user, checkout, return_equipment):
        seed_tag(nfc_token="NFC-012")
        _holder_id, holder_headers = seed_user(username="holder2")
        _other_id, other_headers = seed_user(username="bystander")
        checkout("NFC-012", holder_headers)

        response = return_equipment("NFC-012", other_headers)

        assert response.status_code == 200

    def test_return_by_admin_is_allowed_even_if_not_holder(
        self, client, seed_tag, seed_user, checkout, return_equipment
    ):
        seed_tag(nfc_token="NFC-013")
        _holder_id, holder_headers = seed_user(username="holder3")
        _admin_id, admin_headers = seed_user(username="admin1", role="admin", position=None)
        checkout("NFC-013", holder_headers)

        response = return_equipment("NFC-013", admin_headers)

        assert response.status_code == 200

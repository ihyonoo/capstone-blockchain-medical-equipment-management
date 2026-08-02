"""/usage/checkout, /usage/return 상태 전이 통합 테스트.

tags.asset_status(available <-> checked_out)와 usage_history 행이
NFC 체크아웃/반납 흐름을 따라 정확히 열리고 닫히는지 검증한다.
"""


def _checkout(client, headers, nfc_token):
    return client.post("/usage/checkout", json={"nfc_token": nfc_token}, headers=headers)


def _return(client, headers, nfc_token):
    return client.post("/usage/return", json={"nfc_token": nfc_token}, headers=headers)


class TestCheckout:
    def test_checkout_marks_tag_checked_out(self, client, seed_tag, seed_user, db_conn):
        tag_id = seed_tag(nfc_tag_uid="NFC-001")
        _user_id, headers = seed_user()

        response = _checkout(client, headers, "NFC-001")

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

    def test_checkout_rejects_already_checked_out_tag(self, client, seed_tag, seed_user):
        seed_tag(nfc_tag_uid="NFC-002")
        _user_id, headers = seed_user()
        _checkout(client, headers, "NFC-002")

        response = _checkout(client, headers, "NFC-002")

        assert response.status_code == 409

    def test_checkout_rejects_unauthenticated_request(self, client, seed_tag):
        seed_tag(nfc_tag_uid="NFC-003")

        response = client.post("/usage/checkout", json={"nfc_token": "NFC-003"})

        assert response.status_code == 401


class TestReturn:
    def test_return_by_holder_marks_tag_available(self, client, seed_tag, seed_user, db_conn):
        tag_id = seed_tag(nfc_tag_uid="NFC-010")
        user_id, headers = seed_user(username="holder")
        _checkout(client, headers, "NFC-010")

        response = _return(client, headers, "NFC-010")

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

    def test_return_rejects_when_not_checked_out(self, client, seed_tag, seed_user):
        seed_tag(nfc_tag_uid="NFC-011")
        _user_id, headers = seed_user()

        response = _return(client, headers, "NFC-011")

        assert response.status_code == 409

    def test_return_rejects_non_holder_non_admin(self, client, seed_tag, seed_user):
        seed_tag(nfc_tag_uid="NFC-012")
        _holder_id, holder_headers = seed_user(username="holder2")
        _other_id, other_headers = seed_user(username="bystander")
        _checkout(client, holder_headers, "NFC-012")

        response = _return(client, other_headers, "NFC-012")

        assert response.status_code == 403

    def test_return_by_admin_is_allowed_even_if_not_holder(self, client, seed_tag, seed_user):
        seed_tag(nfc_tag_uid="NFC-013")
        _holder_id, holder_headers = seed_user(username="holder3")
        _admin_id, admin_headers = seed_user(username="admin1", role="admin", position=None)
        _checkout(client, holder_headers, "NFC-013")

        response = _return(client, admin_headers, "NFC-013")

        assert response.status_code == 200

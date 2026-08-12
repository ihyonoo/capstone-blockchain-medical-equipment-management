def test_other_staff_can_return_equipment_checked_out_by_someone_else(client, seed_tag, seed_user):
    """복도에서 장비를 발견한 다른 직원이 대신 반납할 수 있어야 한다."""
    seed_tag(tag_id="EQ-PROXY-0001", equipment_name="수액펌프-001", nfc_tag_uid="pump-001")
    _, borrower_headers = seed_user(username="borrower", role="staff", position="간호사")
    _, other_headers = seed_user(username="other", role="staff", position="의공기사")

    checkout = client.post("/usage/checkout", json={"nfc_token": "pump-001"}, headers=borrower_headers)
    assert checkout.status_code == 200

    returned = client.post("/usage/return", json={"nfc_token": "pump-001"}, headers=other_headers)

    assert returned.status_code == 200
    assert returned.json()["asset_status"] == "available"


def test_return_records_the_actual_returner_not_the_borrower(client, db_conn, seed_tag, seed_user):
    seed_tag(tag_id="EQ-PROXY-0002", equipment_name="수액펌프-002", nfc_tag_uid="pump-002")
    _, borrower_headers = seed_user(username="borrower2", role="staff", position="간호사")
    _, other_headers = seed_user(username="other2", role="staff", position="의공기사")

    client.post("/usage/checkout", json={"nfc_token": "pump-002"}, headers=borrower_headers)
    client.post("/usage/return", json={"nfc_token": "pump-002"}, headers=other_headers)

    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT user_name, returned_by_name, returned_by_position FROM usage_history WHERE tag_id = %s",
            ("EQ-PROXY-0002",),
        )
        user_name, returned_by_name, returned_by_position = cur.fetchone()

    assert user_name == "borrower2"
    assert returned_by_name == "other2"
    assert returned_by_position == "의공기사"


def test_demo_account_cannot_return_someone_elses_checkout(client, seed_tag, seed_user):
    """공개 데모 계정은 남의 대여를 대신 반납할 수 없다 — 대리 반납은 실계정만 허용한다."""
    seed_tag(tag_id="EQ-PROXY-0003", equipment_name="수액펌프-003", nfc_tag_uid="pump-003")
    _, borrower_headers = seed_user(username="borrower3", role="staff", position="간호사")
    _, demo_headers = seed_user(username="demo-staff", role="staff", position="간호사", is_demo=True)

    checkout = client.post("/usage/checkout", json={"nfc_token": "pump-003"}, headers=borrower_headers)
    assert checkout.status_code == 200

    returned = client.post("/usage/return", json={"nfc_token": "pump-003"}, headers=demo_headers)

    assert returned.status_code == 403


def test_demo_account_can_return_its_own_checkout(client, seed_tag, seed_user):
    """본인이 직접 대여한 장비라면 데모 계정도 반납할 수 있다(기존 동작 유지)."""
    seed_tag(tag_id="EQ-PROXY-0004", equipment_name="수액펌프-004", nfc_tag_uid="pump-004")
    _, demo_headers = seed_user(username="demo-staff2", role="staff", position="간호사", is_demo=True)

    checkout = client.post("/usage/checkout", json={"nfc_token": "pump-004"}, headers=demo_headers)
    assert checkout.status_code == 200

    returned = client.post("/usage/return", json={"nfc_token": "pump-004"}, headers=demo_headers)

    assert returned.status_code == 200

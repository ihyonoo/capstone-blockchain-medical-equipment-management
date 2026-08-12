"""사용 이력 조회(/usage/history) 통합 테스트."""


def _seed_checkouts(client, seed_tag, seed_user, count: int, *, is_real_hardware: bool = True, prefix: str = "EQ"):
    """체크아웃만 된 사용 이력을 count건 만든다. 최신순 정렬 시 마지막에 만든 것이 앞에 온다."""
    _, headers = seed_user(username=f"staff-{prefix}", role="staff")
    for index in range(1, count + 1):
        token = f"NFC-{prefix}-{index:03d}"
        seed_tag(
            tag_id=f"{prefix}-{index:04d}",
            equipment_name=f"{prefix} 장비 {index:02d}",
            nfc_tag_uid=token,
            is_real_hardware=is_real_hardware,
        )
        client.post("/usage/checkout", json={"nfc_token": token}, headers=headers)


def _seed_returns(client, seed_tag, seed_user, count: int, *, prefix: str = "DONE"):
    """대여 후 반납까지 끝난 사용 이력을 count건 만든다."""
    _, headers = seed_user(username=f"staff-{prefix}", role="staff")
    for index in range(1, count + 1):
        token = f"NFC-{prefix}-{index:03d}"
        seed_tag(
            tag_id=f"{prefix}-{index:04d}",
            equipment_name=f"{prefix} 장비 {index:02d}",
            nfc_tag_uid=token,
        )
        client.post("/usage/checkout", json={"nfc_token": token}, headers=headers)
        client.post("/usage/return", json={"nfc_token": token}, headers=headers)


class TestUsageHistoryIncludeInUse:
    def test_excludes_in_use_records_from_both_the_page_and_the_total(self, client, seed_tag, seed_user):
        _seed_returns(client, seed_tag, seed_user, 2)
        _seed_checkouts(client, seed_tag, seed_user, 3, prefix="INUSE")
        _, admin_headers = seed_user(username="admin1", role="admin", position=None)

        body = client.get("/usage/history?include_in_use=false", headers=admin_headers).json()

        assert body["total"] == 2
        assert all(item["return"]["at"] is not None for item in body["items"])

    def test_keeps_in_use_records_when_the_flag_is_on(self, client, seed_tag, seed_user):
        _seed_returns(client, seed_tag, seed_user, 2)
        _seed_checkouts(client, seed_tag, seed_user, 3, prefix="INUSE")
        _, admin_headers = seed_user(username="admin1", role="admin", position=None)

        body = client.get("/usage/history?include_in_use=true", headers=admin_headers).json()

        assert body["total"] == 5

    def test_keeps_in_use_records_by_default(self, client, seed_tag, seed_user):
        _seed_returns(client, seed_tag, seed_user, 2)
        _seed_checkouts(client, seed_tag, seed_user, 3, prefix="INUSE")
        _, admin_headers = seed_user(username="admin1", role="admin", position=None)

        body = client.get("/usage/history", headers=admin_headers).json()

        assert body["total"] == 5


class TestUsageHistoryPaging:
    def test_reports_the_total_so_the_client_can_count_pages(self, client, seed_tag, seed_user):
        _seed_checkouts(client, seed_tag, seed_user, 5)
        _, admin_headers = seed_user(username="admin1", role="admin", position=None)

        response = client.get("/usage/history?limit=2", headers=admin_headers)

        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 5
        assert body["count"] == 2
        assert len(body["items"]) == 2

    def test_offset_moves_to_the_next_page_without_repeating_records(self, client, seed_tag, seed_user):
        _seed_checkouts(client, seed_tag, seed_user, 5)
        _, admin_headers = seed_user(username="admin1", role="admin", position=None)

        first = client.get("/usage/history?limit=2&offset=0", headers=admin_headers).json()
        second = client.get("/usage/history?limit=2&offset=2", headers=admin_headers).json()

        first_ids = [item["usage_id"] for item in first["items"]]
        second_ids = [item["usage_id"] for item in second["items"]]
        assert len(first_ids) == 2
        assert len(second_ids) == 2
        assert set(first_ids).isdisjoint(second_ids)
        assert second["total"] == 5

    def test_offset_past_the_end_returns_no_items_but_still_reports_the_total(self, client, seed_tag, seed_user):
        _seed_checkouts(client, seed_tag, seed_user, 3)
        _, admin_headers = seed_user(username="admin1", role="admin", position=None)

        body = client.get("/usage/history?limit=10&offset=99", headers=admin_headers).json()

        assert body["items"] == []
        assert body["total"] == 3

    def test_negative_offset_is_treated_as_the_first_page(self, client, seed_tag, seed_user):
        _seed_checkouts(client, seed_tag, seed_user, 3)
        _, admin_headers = seed_user(username="admin1", role="admin", position=None)

        body = client.get("/usage/history?limit=10&offset=-5", headers=admin_headers).json()

        assert len(body["items"]) == 3


class TestUsageHistoryHideSimulated:
    def test_excludes_simulated_records_from_both_the_page_and_the_total(self, client, seed_tag, seed_user):
        _seed_checkouts(client, seed_tag, seed_user, 2, is_real_hardware=True, prefix="REAL")
        _seed_checkouts(client, seed_tag, seed_user, 3, is_real_hardware=False, prefix="SIM")
        _, admin_headers = seed_user(username="admin1", role="admin", position=None)

        body = client.get("/usage/history?hide_simulated=true", headers=admin_headers).json()

        assert body["total"] == 2
        assert all(item["equipment"]["is_real_hardware"] is True for item in body["items"])

    def test_keeps_everything_when_the_flag_is_off(self, client, seed_tag, seed_user):
        _seed_checkouts(client, seed_tag, seed_user, 2, is_real_hardware=True, prefix="REAL")
        _seed_checkouts(client, seed_tag, seed_user, 3, is_real_hardware=False, prefix="SIM")
        _, admin_headers = seed_user(username="admin1", role="admin", position=None)

        body = client.get("/usage/history", headers=admin_headers).json()

        assert body["total"] == 5


class TestUsageHistoryProvenance:
    def test_requires_admin_role(self, client, seed_user):
        _, headers = seed_user(username="staffer", role="staff")

        response = client.get("/usage/history", headers=headers)

        assert response.status_code == 403

    def test_marks_records_made_with_simulated_equipment(self, client, seed_tag, seed_user):
        seed_tag(tag_id="EQ-REAL-0001", equipment_name="실물 장비", nfc_tag_uid="NFC-REAL", is_real_hardware=True)
        seed_tag(tag_id="EQ-SIM-0001", equipment_name="모의 장비", nfc_tag_uid="NFC-SIM", is_real_hardware=False)
        _, staff_headers = seed_user(username="staffer", role="staff")
        client.post("/usage/checkout", json={"nfc_token": "NFC-REAL"}, headers=staff_headers)
        client.post("/usage/checkout", json={"nfc_token": "NFC-SIM"}, headers=staff_headers)
        _, admin_headers = seed_user(username="admin1", role="admin", position=None)

        response = client.get("/usage/history", headers=admin_headers)

        assert response.status_code == 200
        items = {item["equipment"]["tag_id"]: item for item in response.json()["items"]}
        assert items["EQ-REAL-0001"]["equipment"]["is_real_hardware"] is True
        assert items["EQ-SIM-0001"]["equipment"]["is_real_hardware"] is False

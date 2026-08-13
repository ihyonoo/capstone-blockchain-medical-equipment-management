"""NFC 매핑 목록 조회(/admin/nfc-mappings) 통합 테스트."""


class TestListNfcMappings:
    def test_requires_admin_role(self, client, seed_user):
        _, headers = seed_user(username="staffer", role="staff")

        response = client.get("/admin/nfc-mappings", headers=headers)

        assert response.status_code == 403

    def test_marks_simulated_equipment_so_the_admin_can_hide_it(self, client, seed_tag, seed_user):
        seed_tag(tag_id="EQ-REAL-0001", equipment_name="실물 장비", is_real_hardware=True)
        seed_tag(tag_id="EQ-SIM-0001", equipment_name="모의 장비", is_real_hardware=False)
        _, headers = seed_user(username="admin1", role="admin", position=None)

        response = client.get("/admin/nfc-mappings", headers=headers)

        assert response.status_code == 200
        items = {item["tag_id"]: item for item in response.json()["items"]}
        assert items["EQ-REAL-0001"]["is_real_hardware"] is True
        assert items["EQ-SIM-0001"]["is_real_hardware"] is False

    def test_reports_when_each_tag_was_registered_so_the_admin_can_sort_by_it(self, client, seed_tag, seed_user):
        seed_tag(tag_id="EQ-0001", equipment_name="장비 1")
        _, headers = seed_user(username="admin1", role="admin", position=None)

        response = client.get("/admin/nfc-mappings", headers=headers)

        assert response.status_code == 200
        item = response.json()["items"][0]
        assert isinstance(item["created_at"], int)
        assert item["created_at"] > 0

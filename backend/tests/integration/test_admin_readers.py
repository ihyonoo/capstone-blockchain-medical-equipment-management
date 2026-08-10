"""리더 목록 조회(/admin/readers) 통합 테스트."""


class TestListAdminReaders:
    def test_requires_admin_role(self, client, seed_reader, seed_user):
        seed_reader("M101")
        _, headers = seed_user(username="staffer", role="staff")

        response = client.get("/admin/readers", headers=headers)

        assert response.status_code == 403

    def test_returns_reader_with_floor_field(self, client, seed_reader, seed_user):
        seed_reader("M101", location_name="1층 병동 A", is_real_hardware=False)
        _, headers = seed_user(username="admin1", role="admin", position=None)

        response = client.get("/admin/readers", headers=headers)

        assert response.status_code == 200
        body = response.json()
        items = {item["reader_id"]: item for item in body["items"]}
        assert items["M101"]["location_name"] == "1층 병동 A"
        assert items["M101"]["floor"] is None
        assert "map_x" not in items["M101"]
        assert "map_y" not in items["M101"]
        assert items["M101"]["is_real_hardware"] is False

    def test_filters_by_floor(self, client, seed_reader, seed_user, db_conn):
        seed_reader("M101")
        seed_reader("M201")
        with db_conn.cursor() as cur:
            cur.execute("UPDATE readers SET floor=1 WHERE reader_id='M101'")
            cur.execute("UPDATE readers SET floor=2 WHERE reader_id='M201'")
        db_conn.commit()
        _, headers = seed_user(username="admin1", role="admin", position=None)

        response = client.get("/admin/readers?floor=1", headers=headers)

        assert response.status_code == 200
        reader_ids = {item["reader_id"] for item in response.json()["items"]}
        assert reader_ids == {"M101"}

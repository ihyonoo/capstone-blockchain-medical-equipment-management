"""/auth/demo-login 통합 테스트.

포트폴리오 방문자가 회원가입 없이 의료진·관리자 화면을 둘러볼 수 있도록 하는
데모 세션 발급과, 그 세션이 계정 자체를 망가뜨리지 못하게 막는 가드를 검증한다.
"""

import pytest


def _demo_login(client, role="staff"):
    return client.post("/auth/demo-login", json={"role": role})


class TestDemoLogin:
    def test_issues_session_for_staff(self, client):
        response = _demo_login(client, role="staff")

        assert response.status_code == 200
        body = response.json()
        assert body["ok"] is True
        assert body["token"]
        assert body["user"]["role"] == "staff"
        assert body["user"]["is_demo"] is True

    def test_issues_session_for_admin(self, client):
        response = _demo_login(client, role="admin")

        assert response.status_code == 200
        assert response.json()["user"]["role"] == "admin"

    def test_created_account_is_verified_and_active(self, client, db_conn):
        _demo_login(client, role="staff")

        with db_conn.cursor() as cur:
            cur.execute("SELECT is_active, email_verified, password_hash, is_demo FROM users WHERE role = 'staff'")
            is_active, email_verified, password_hash, is_demo = cur.fetchone()
        assert is_active is True
        assert email_verified is True
        assert password_hash is None
        assert is_demo is True

    def test_reuses_same_account_across_calls(self, client, db_conn):
        first = _demo_login(client, role="staff").json()["user"]["user_id"]
        second = _demo_login(client, role="staff").json()["user"]["user_id"]

        assert first == second
        with db_conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM users")
            (count,) = cur.fetchone()
        assert count == 1

    def test_session_can_access_protected_endpoint(self, client):
        token = _demo_login(client, role="admin").json()["token"]

        response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

        assert response.status_code == 200
        assert response.json()["user"]["role"] == "admin"

    def test_rejects_invalid_role(self, client):
        response = _demo_login(client, role="superuser")

        assert response.status_code == 400

    def test_returns_404_when_disabled(self, client, monkeypatch):
        monkeypatch.setattr("backend.server.DEMO_LOGIN_ENABLED", False)

        response = _demo_login(client, role="staff")

        assert response.status_code == 404

    def test_demo_account_cannot_login_with_password_form(self, client):
        _demo_login(client, role="staff")

        response = client.post("/auth/login", json={"username": "demo-staff", "password": "demo", "role": "staff"})

        assert response.status_code == 401


class TestDemoAccountGuards:
    """데모 세션은 업무 기능은 쓰되 계정 자체는 건드리지 못한다."""

    @pytest.fixture
    def demo_headers(self, client):
        token = _demo_login(client, role="staff").json()["token"]
        return {"Authorization": f"Bearer {token}"}

    def test_cannot_withdraw(self, client, demo_headers):
        response = client.post("/auth/withdraw", json={"current_password": "whatever"}, headers=demo_headers)

        assert response.status_code == 403

    def test_cannot_change_password(self, client, demo_headers):
        response = client.post(
            "/auth/change-password",
            json={"current_password": "whatever", "new_password": "Str0ng!Passw0rd"},
            headers=demo_headers,
        )

        assert response.status_code == 403

    def test_cannot_change_email(self, client, demo_headers):
        response = client.post(
            "/auth/change-email",
            json={"new_email": "hijack@example.com", "current_password": "whatever"},
            headers=demo_headers,
        )

        assert response.status_code == 403

    def test_cannot_unlink_google(self, client, demo_headers):
        response = client.post("/auth/google/unlink", headers=demo_headers)

        assert response.status_code == 403

    def test_cannot_upsert_nfc_mapping(self, client):
        token = _demo_login(client, role="admin").json()["token"]

        response = client.post(
            "/admin/nfc-mappings",
            json={"tag_id": "EQ-TEST-0001", "nfc_token": "pump-001"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403

    def test_cannot_remove_nfc_mapping(self, client):
        token = _demo_login(client, role="admin").json()["token"]

        response = client.delete(
            "/admin/nfc-mappings/EQ-TEST-0001",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403

    def test_normal_account_can_still_change_password(self, client, seed_user):
        _, headers = seed_user(username="realuser", password="Str0ng!Passw0rd")

        response = client.post(
            "/auth/change-password",
            json={"current_password": "Str0ng!Passw0rd", "new_password": "An0ther!Passw0rd"},
            headers=headers,
        )

        assert response.status_code == 200

import time
from unittest.mock import MagicMock, patch

import pytest
import requests
from fastapi import HTTPException

from backend.google_oauth import exchange_code, sign_state, verify_state


def _resp(status_code: int, json_data: dict | None = None) -> MagicMock:
    """가짜 requests.Response를 만든다."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_data or {}
    return resp


class TestOAuthState:
    def test_round_trip_defaults_to_login_mode(self):
        state = sign_state("login")
        assert verify_state(state) == "login"

    def test_round_trip_signup_mode(self):
        state = sign_state("signup")
        assert verify_state(state) == "signup"

    def test_rejects_tampered_signature(self):
        state = sign_state("login")
        segment, _sig = state.split(".", 1)
        with pytest.raises(HTTPException) as exc:
            verify_state(f"{segment}.tampered")
        assert exc.value.status_code == 400

    def test_rejects_malformed_state(self):
        with pytest.raises(HTTPException) as exc:
            verify_state("not-a-valid-state")
        assert exc.value.status_code == 400

    def test_rejects_expired_state(self, monkeypatch):
        state = sign_state("login")
        # OAUTH_STATE_TTL_SEC 이후 시각으로 이동시켜 만료를 재현한다.
        future = time.time() + 10_000
        monkeypatch.setattr(time, "time", lambda: future)
        with pytest.raises(HTTPException) as exc:
            verify_state(state)
        assert exc.value.status_code == 400


class TestExchangeCode:
    TOKEN_OK = _resp(200, {"access_token": "fake-access-token"})
    USERINFO_OK = _resp(
        200,
        {
            "sub": "1234567890",
            "email": "User@Example.com",
            "email_verified": True,
            "name": "홍길동",
        },
    )

    def test_success_returns_parsed_userinfo(self):
        with (
            patch("backend.google_oauth.requests.post", return_value=self.TOKEN_OK) as mock_post,
            patch("backend.google_oauth.requests.get", return_value=self.USERINFO_OK) as mock_get,
        ):
            result = exchange_code("auth-code")

        assert result == {
            "sub": "1234567890",
            "email": "user@example.com",  # 소문자로 정규화된다.
            "email_verified": True,
            "name": "홍길동",
        }
        mock_post.assert_called_once()
        mock_get.assert_called_once()
        # access token이 Authorization 헤더로 전달되는지 확인한다.
        assert mock_get.call_args.kwargs["headers"] == {"Authorization": "Bearer fake-access-token"}

    def test_token_exchange_network_error_raises_502(self):
        with (
            patch("backend.google_oauth.requests.post", side_effect=requests.RequestException("boom")),
            pytest.raises(HTTPException) as exc,
        ):
            exchange_code("auth-code")
        assert exc.value.status_code == 502

    def test_token_exchange_non_200_raises_401(self):
        with (
            patch("backend.google_oauth.requests.post", return_value=_resp(400, {"error": "invalid_grant"})),
            pytest.raises(HTTPException) as exc,
        ):
            exchange_code("auth-code")
        assert exc.value.status_code == 401

    def test_token_exchange_missing_access_token_raises_401(self):
        with (
            patch("backend.google_oauth.requests.post", return_value=_resp(200, {})),
            pytest.raises(HTTPException) as exc,
        ):
            exchange_code("auth-code")
        assert exc.value.status_code == 401

    def test_userinfo_network_error_raises_502(self):
        with (
            patch("backend.google_oauth.requests.post", return_value=self.TOKEN_OK),
            patch("backend.google_oauth.requests.get", side_effect=requests.RequestException("boom")),
            pytest.raises(HTTPException) as exc,
        ):
            exchange_code("auth-code")
        assert exc.value.status_code == 502

    def test_userinfo_non_200_raises_401(self):
        with (
            patch("backend.google_oauth.requests.post", return_value=self.TOKEN_OK),
            patch("backend.google_oauth.requests.get", return_value=_resp(403, {})),
            pytest.raises(HTTPException) as exc,
        ):
            exchange_code("auth-code")
        assert exc.value.status_code == 401

    def test_userinfo_missing_sub_raises_401(self):
        missing_sub = _resp(200, {"email": "user@example.com", "email_verified": True})
        with (
            patch("backend.google_oauth.requests.post", return_value=self.TOKEN_OK),
            patch("backend.google_oauth.requests.get", return_value=missing_sub),
            pytest.raises(HTTPException) as exc,
        ):
            exchange_code("auth-code")
        assert exc.value.status_code == 401

    def test_userinfo_missing_email_raises_401(self):
        missing_email = _resp(200, {"sub": "1234567890", "email_verified": True})
        with (
            patch("backend.google_oauth.requests.post", return_value=self.TOKEN_OK),
            patch("backend.google_oauth.requests.get", return_value=missing_email),
            pytest.raises(HTTPException) as exc,
        ):
            exchange_code("auth-code")
        assert exc.value.status_code == 401

    def test_defaults_email_verified_false_and_name_empty_when_absent(self):
        # email_verified/name 필드가 응답에 없으면 각각 False/빈 문자열로 기본값 처리된다.
        no_optional_fields = _resp(200, {"sub": "1234567890", "email": "user@example.com"})
        with (
            patch("backend.google_oauth.requests.post", return_value=self.TOKEN_OK),
            patch("backend.google_oauth.requests.get", return_value=no_optional_fields),
        ):
            result = exchange_code("auth-code")
        assert result["email_verified"] is False
        assert result["name"] == ""

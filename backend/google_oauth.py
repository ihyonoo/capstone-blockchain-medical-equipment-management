"""Google OAuth 2.0 (authorization code / redirect) 헬퍼.

- `state`는 CSRF 방지를 위해 HMAC-SHA256으로 서명한 단기 토큰이다(서버 저장 불필요).
- authorization code → access/id 토큰 교환 및 userinfo 조회를 담당한다.
무거운 google-auth 의존 대신 Google 표준 엔드포인트를 직접 호출한다.
"""

import base64
import hashlib
import hmac
import json
import time
import urllib.parse

import requests
from fastapi import HTTPException

try:
    from backend.settings import (
        AUTH_TOKEN_SECRET,
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI,
        OAUTH_STATE_TTL_SEC,
    )
except ModuleNotFoundError as exc:
    if not exc.name or not exc.name.startswith("backend"):
        raise
    from settings import (
        AUTH_TOKEN_SECRET,
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI,
        OAUTH_STATE_TTL_SEC,
    )

AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo"


def is_google_configured() -> bool:
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI)


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def sign_state(mode: str) -> str:
    """{mode, exp} 를 HMAC 서명한 state 문자열을 만든다."""
    payload = {"mode": mode, "exp": int(time.time()) + OAUTH_STATE_TTL_SEC}
    segment = _b64(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(AUTH_TOKEN_SECRET.encode("utf-8"), segment.encode("ascii"), hashlib.sha256).digest()
    return f"{segment}.{_b64(signature)}"


def verify_state(state: str) -> str:
    """state를 검증하고 mode를 반환한다. 실패 시 HTTPException(400)."""
    try:
        segment, signature_segment = state.split(".", 1)
    except (ValueError, AttributeError):
        raise HTTPException(400, "잘못된 OAuth state입니다.")
    expected = hmac.new(AUTH_TOKEN_SECRET.encode("utf-8"), segment.encode("ascii"), hashlib.sha256).digest()
    if not hmac.compare_digest(expected, _unb64(signature_segment)):
        raise HTTPException(400, "OAuth state 검증에 실패했습니다.")
    try:
        payload = json.loads(_unb64(segment))
    except Exception:
        raise HTTPException(400, "OAuth state를 해석하지 못했습니다.")
    if int(payload.get("exp", 0)) <= int(time.time()):
        raise HTTPException(400, "OAuth 요청이 만료되었습니다. 다시 시도해 주세요.")
    mode = payload.get("mode")
    return mode if mode in ("login", "signup") else "login"


def build_authorization_url(state: str) -> str:
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{AUTH_ENDPOINT}?{urllib.parse.urlencode(params)}"


def exchange_code(code: str) -> dict:
    """authorization code를 토큰으로 교환하고 userinfo를 반환한다.

    반환: {sub, email, email_verified, name}
    """
    try:
        token_resp = requests.post(
            TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            timeout=15,
        )
    except requests.RequestException:
        raise HTTPException(502, "Google 인증 서버와 통신하지 못했습니다.")
    if token_resp.status_code != 200:
        raise HTTPException(401, "Google 인증 코드 교환에 실패했습니다.")

    access_token = token_resp.json().get("access_token")
    if not access_token:
        raise HTTPException(401, "Google access token을 받지 못했습니다.")

    try:
        userinfo_resp = requests.get(
            USERINFO_ENDPOINT,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15,
        )
    except requests.RequestException:
        raise HTTPException(502, "Google 사용자 정보를 조회하지 못했습니다.")
    if userinfo_resp.status_code != 200:
        raise HTTPException(401, "Google 사용자 정보 조회에 실패했습니다.")

    info = userinfo_resp.json()
    sub = info.get("sub")
    email = info.get("email")
    if not sub or not email:
        raise HTTPException(401, "Google 계정에서 필요한 정보를 얻지 못했습니다.")

    return {
        "sub": str(sub),
        "email": str(email).strip().lower(),
        "email_verified": bool(info.get("email_verified", False)),
        "name": info.get("name") or "",
    }

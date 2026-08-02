"""auth_tokens.py의 일회성 액션 토큰(이메일 인증/비밀번호 재설정 등) 발급·소비 테스트.

해시만 DB(auth_action_tokens)에 저장되고 원문은 반환값에만 존재하는 패턴,
그리고 일회성(재사용 불가)·만료 처리를 실제 테스트 DB로 검증한다.
"""

from backend.auth_tokens import consume_action_token, create_action_token


class TestActionTokenRoundTrip:
    def test_consume_returns_payload_for_valid_token(self, seed_user):
        user_id, _headers = seed_user()
        raw_token = create_action_token(purpose="email_verify", ttl_sec=3600, user_id=user_id, payload={"foo": "bar"})

        result = consume_action_token(raw_token, "email_verify")

        assert result is not None
        assert result["user_id"] == user_id
        assert result["payload"] == {"foo": "bar"}

    def test_token_can_only_be_consumed_once(self):
        # user_id는 oauth_handoff/pending처럼 NULL 허용 — FK 없이도 재사용 방지 로직만 검증하면 된다.
        raw_token = create_action_token(purpose="password_reset", ttl_sec=3600, user_id=None)

        first = consume_action_token(raw_token, "password_reset")
        second = consume_action_token(raw_token, "password_reset")

        assert first is not None
        assert second is None

    def test_rejects_wrong_purpose(self):
        raw_token = create_action_token(purpose="email_verify", ttl_sec=3600, user_id=None)

        result = consume_action_token(raw_token, "password_reset")

        assert result is None

    def test_rejects_expired_token(self):
        raw_token = create_action_token(purpose="email_verify", ttl_sec=-1, user_id=None)

        result = consume_action_token(raw_token, "email_verify")

        assert result is None

    def test_rejects_unknown_token(self):
        assert consume_action_token("not-a-real-token", "email_verify") is None

    def test_rejects_empty_token(self):
        assert consume_action_token("", "email_verify") is None

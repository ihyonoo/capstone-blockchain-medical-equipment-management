import logging
import smtplib
from unittest.mock import MagicMock

import pytest

from backend import email_utils


@pytest.fixture
def unconfigured_smtp(monkeypatch):
    """SMTP 자격증명이 비어 있는 상태(dev 폴백 경로)를 재현한다."""
    monkeypatch.setattr(email_utils, "SMTP_HOST", "")
    monkeypatch.setattr(email_utils, "SMTP_USER", "")
    monkeypatch.setattr(email_utils, "SMTP_PASSWORD", "")
    monkeypatch.setattr(email_utils, "SMTP_FROM", "")


@pytest.fixture
def configured_smtp(monkeypatch):
    """SMTP 자격증명이 모두 설정된 상태를 재현한다."""
    monkeypatch.setattr(email_utils, "SMTP_HOST", "smtp.gmail.com")
    monkeypatch.setattr(email_utils, "SMTP_PORT", 587)
    monkeypatch.setattr(email_utils, "SMTP_USER", "bot@example.com")
    monkeypatch.setattr(email_utils, "SMTP_PASSWORD", "app-password")
    monkeypatch.setattr(email_utils, "SMTP_FROM", "bot@example.com")


@pytest.fixture
def mock_smtp(monkeypatch):
    """smtplib.SMTP를 with-문 컨텍스트 매니저처럼 동작하는 mock으로 교체.

    실제 네트워크 접속이 발생하지 않도록 email_utils가 참조하는
    smtplib 모듈 객체의 SMTP 속성을 통째로 mock으로 바꾼다.
    """
    server = MagicMock()
    smtp_cls = MagicMock()
    smtp_cls.return_value.__enter__.return_value = server
    smtp_cls.return_value.__exit__.return_value = False
    monkeypatch.setattr(email_utils.smtplib, "SMTP", smtp_cls)
    return smtp_cls, server


class TestDevFallback:
    """SMTP 미설정 시 실제 발송 없이 로그만 남기는지 검증."""

    def test_send_verification_email_logs_without_connecting(self, unconfigured_smtp, mock_smtp, caplog):
        smtp_cls, _server = mock_smtp
        with caplog.at_level(logging.WARNING, logger="mediledger.email"):
            email_utils.send_verification_email("user@example.com", "http://app.local/verify?token=abc")
        smtp_cls.assert_not_called()
        assert "user@example.com" in caplog.text
        assert "http://app.local/verify?token=abc" in caplog.text

    def test_send_reset_email_logs_without_connecting(self, unconfigured_smtp, mock_smtp, caplog):
        smtp_cls, _server = mock_smtp
        with caplog.at_level(logging.WARNING, logger="mediledger.email"):
            email_utils.send_reset_email("user@example.com", "http://app.local/reset?token=xyz")
        smtp_cls.assert_not_called()
        assert "user@example.com" in caplog.text
        assert "http://app.local/reset?token=xyz" in caplog.text

    def test_send_find_id_email_logs_without_connecting(self, unconfigured_smtp, mock_smtp, caplog):
        smtp_cls, _server = mock_smtp
        with caplog.at_level(logging.WARNING, logger="mediledger.email"):
            email_utils.send_find_id_email("user@example.com", ["alice", "bob"])
        smtp_cls.assert_not_called()
        assert "user@example.com" in caplog.text
        assert "alice" in caplog.text
        assert "bob" in caplog.text


class TestConfiguredSend:
    """SMTP 자격증명이 있을 때 올바른 인자로 메일을 구성해 발송하는지 검증."""

    def test_send_verification_email_sends_via_smtp(self, configured_smtp, mock_smtp):
        smtp_cls, server = mock_smtp
        email_utils.send_verification_email("user@example.com", "http://app.local/verify?token=abc")

        smtp_cls.assert_called_once_with("smtp.gmail.com", 587, timeout=15)
        server.starttls.assert_called_once()
        server.login.assert_called_once_with("bot@example.com", "app-password")
        server.send_message.assert_called_once()

        sent = server.send_message.call_args[0][0]
        assert sent["From"] == "bot@example.com"
        assert sent["To"] == "user@example.com"
        assert "인증" in sent["Subject"]
        assert "http://app.local/verify?token=abc" in sent.get_content()

    def test_send_reset_email_sends_via_smtp(self, configured_smtp, mock_smtp):
        smtp_cls, server = mock_smtp
        email_utils.send_reset_email("user@example.com", "http://app.local/reset?token=xyz")

        smtp_cls.assert_called_once_with("smtp.gmail.com", 587, timeout=15)
        server.starttls.assert_called_once()
        server.login.assert_called_once_with("bot@example.com", "app-password")
        server.send_message.assert_called_once()

        sent = server.send_message.call_args[0][0]
        assert sent["To"] == "user@example.com"
        assert "재설정" in sent["Subject"]
        assert "http://app.local/reset?token=xyz" in sent.get_content()

    def test_send_find_id_email_sends_via_smtp(self, configured_smtp, mock_smtp):
        smtp_cls, server = mock_smtp
        email_utils.send_find_id_email("user@example.com", ["alice", "bob"])

        smtp_cls.assert_called_once_with("smtp.gmail.com", 587, timeout=15)
        server.starttls.assert_called_once()
        server.login.assert_called_once_with("bot@example.com", "app-password")
        server.send_message.assert_called_once()

        sent = server.send_message.call_args[0][0]
        assert sent["To"] == "user@example.com"
        assert "아이디" in sent["Subject"]
        body = sent.get_content()
        assert "alice" in body
        assert "bob" in body


class TestSendFailureIsSwallowed:
    """SMTP 통신 중 예외가 나도 호출부로 전파되지 않는지 검증."""

    def test_login_failure_does_not_propagate(self, configured_smtp, mock_smtp, caplog):
        smtp_cls, server = mock_smtp
        server.login.side_effect = smtplib.SMTPAuthenticationError(535, b"bad creds")

        with caplog.at_level(logging.ERROR, logger="mediledger.email"):
            email_utils.send_verification_email("user@example.com", "http://app.local/verify")

        smtp_cls.assert_called_once()
        assert "발송 실패" in caplog.text

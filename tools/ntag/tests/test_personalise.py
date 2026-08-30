"""개인화 절차의 판단 로직. 리더 I/O는 키를 구분하는 가짜 태그로 대신한다."""

import pytest

from tools.ntag.crypto import (
    decrypt_rnd_b,
    encrypt_command_data,
    rotate_left,
)
from tools.ntag.personalise import SDM_FILE_READ_KEY_NO, detect_state
from tools.ntag.tests.test_session import RND_A

FACTORY = bytes(16)
DERIVED = bytes(range(16))
TI = bytes.fromhex("9D00C4DF")
RND_B = bytes.fromhex("B9E2FC789B64BF237CCCAA20EC7E6E48")


class KeyAwareTransport:
    """지정한 키로만 인증이 성립하는 가짜 태그.

    다른 키로 접근하면 챌린지 복호화가 어긋나 RndA가 되돌아오지 않으므로,
    실제 태그와 같은 이유로 인증이 실패한다.
    """

    def __init__(self, accepted_key: bytes):
        self.accepted_key = accepted_key
        self.sent: list[bytes] = []

    def transmit(self, apdu: bytes) -> tuple[bytes, str]:
        self.sent.append(apdu)
        if apdu[:2] == b"\x00\xa4":
            return b"", "9000"
        if apdu[1] == 0x71:
            return encrypt_command_data(self.accepted_key, bytes(16), RND_B, already_padded=True), "91AF"
        if apdu[1] == 0xAF:
            challenge = apdu[5:-1]
            plain = decrypt_rnd_b(self.accepted_key, challenge)
            rnd_a = plain[:16]
            response = TI + rotate_left(rnd_a) + bytes(12)
            return encrypt_command_data(self.accepted_key, bytes(16), response, already_padded=True), "9100"
        return b"", "9100"


@pytest.fixture
def fixed_rnd_a(monkeypatch):
    monkeypatch.setattr("tools.ntag.session.generate_random", lambda n: RND_A[:n])


class TestDetectState:
    def test_probes_the_key_that_actually_gets_rotated(self, fixed_rnd_a):
        """키 0은 공장값 그대로 두므로, 키 0으로 물으면 완성된 태그도 factory로 오판한다."""
        transport = KeyAwareTransport(FACTORY)

        detect_state(transport, tag_key=DERIVED)

        auth_apdus = [a for a in transport.sent if a[1] == 0x71]
        assert auth_apdus, "인증을 시도하지 않았다"
        assert all(a[5] == SDM_FILE_READ_KEY_NO for a in auth_apdus)

    def test_reports_factory_when_the_factory_key_authenticates(self, fixed_rnd_a):
        assert detect_state(KeyAwareTransport(FACTORY), tag_key=DERIVED) == "factory"

    def test_reports_rotated_when_only_the_derived_key_authenticates(self, fixed_rnd_a):
        """공장 키로 먼저 시도해 실패한 뒤 파생 키로 성공하는 경로."""
        assert detect_state(KeyAwareTransport(DERIVED), tag_key=DERIVED) == "rotated"

    def test_reports_unknown_when_neither_key_authenticates(self, fixed_rnd_a):
        assert detect_state(KeyAwareTransport(bytes([0xAA] * 16)), tag_key=DERIVED) == "unknown"

    def test_a_failed_probe_does_not_stop_the_next_one(self, fixed_rnd_a):
        """공장 키 시도가 실패해도 파생 키 시도가 이어져야 한다 — 아니면 rotated를 못 찾는다."""
        transport = KeyAwareTransport(DERIVED)

        detect_state(transport, tag_key=DERIVED)

        assert len([a for a in transport.sent if a[1] == 0x71]) == 2

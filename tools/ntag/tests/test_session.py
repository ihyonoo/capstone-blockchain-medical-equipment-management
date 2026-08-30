"""AN12196 §6.6 인증 흐름 전체를 가짜 transport로 재생한다.

리더 없이도 명령 조립·응답 해석·세션 상태 전이가 실제 벡터와 맞는지 확인한다.
"""

import pytest

from tools.ntag.session import AuthenticationError, CommandError, Ntag424Session

# AN12196 Table 14
KEY0 = bytes.fromhex("00000000000000000000000000000000")
RND_A = bytes.fromhex("13C5DB8A5930439FC3DEF9A4C675360F")
ENC_RND_B = bytes.fromhex("A04C124213C186F22399D33AC2A30215")
AUTH_PART2_RESPONSE = bytes.fromhex("3FA64DB5446D1F34CD6EA311167F5E4985B89690C04A05F17FA7AB2F08120663")
EXPECTED_TI = bytes.fromhex("9D00C4DF")
EXPECTED_SES_ENC = bytes.fromhex("1309C877509E5A215007FF0ED19CA564")
EXPECTED_SES_MAC = bytes.fromhex("4C6626F5E72EA694202139295C7A7FC7")
# AN12196 §6.4가 밝힌 공장 출고 NDEF 파일 설정.
# FileType(00) || FileOption(00, SDM 꺼짐) || AccessRights(E0EE, 쓰기 free) || FileSize(000100)
FACTORY_FILE_SETTINGS = bytes.fromhex("0000E0EE000100")


class FakeTransport:
    """AN12196 예제와 똑같이 답하는 가짜 태그."""

    def __init__(
        self,
        *,
        part2_response: bytes = AUTH_PART2_RESPONSE,
        file_settings: bytes = FACTORY_FILE_SETTINGS,
    ):
        self.sent: list[bytes] = []
        self._part2_response = part2_response
        self._file_settings = file_settings

    def transmit(self, apdu: bytes) -> tuple[bytes, str]:
        self.sent.append(apdu)
        if apdu[:2] == b"\x00\xa4":  # ISO SELECT
            return b"", "9000"
        if apdu[:2] == b"\x00\xd6":  # ISO UPDATE BINARY
            return b"", "9000"
        if apdu[1] == 0xF5:  # GetFileSettings
            return self._file_settings, "9100"
        if apdu[1] == 0x71:  # AuthenticateEV2First part 1
            return ENC_RND_B, "91AF"
        if apdu[1] == 0xAF:  # part 2
            return self._part2_response, "9100"
        return b"", "9100"


@pytest.fixture
def fixed_rnd_a(monkeypatch):
    monkeypatch.setattr("tools.ntag.session.generate_random", lambda n: RND_A[:n])


class TestAuthenticateEv2First:
    def test_derives_the_session_keys_from_the_an12196_vector(self, fixed_rnd_a):
        session = Ntag424Session(FakeTransport())

        session.authenticate_ev2_first(0x00, KEY0)

        assert session.ti == EXPECTED_TI
        assert session.ses_enc == EXPECTED_SES_ENC
        assert session.ses_mac == EXPECTED_SES_MAC

    def test_sends_the_expected_first_apdu(self, fixed_rnd_a):
        transport = FakeTransport()
        session = Ntag424Session(transport)

        session.authenticate_ev2_first(0x00, KEY0)

        assert transport.sent[0].hex().upper() == "9071000002000000"

    def test_resets_the_command_counter(self, fixed_rnd_a):
        session = Ntag424Session(FakeTransport())
        session.cmd_ctr = 7

        session.authenticate_ev2_first(0x00, KEY0)

        assert session.cmd_ctr == 0

    def test_rejects_a_tag_that_returns_the_wrong_rnd_a(self, fixed_rnd_a):
        """RndA가 되돌아오지 않으면 상대가 키를 모른다는 뜻이다 — 진행하면 안 된다."""
        tampered = bytearray(AUTH_PART2_RESPONSE)
        tampered[0] ^= 0x01
        session = Ntag424Session(FakeTransport(part2_response=bytes(tampered)))

        with pytest.raises(AuthenticationError):
            session.authenticate_ev2_first(0x00, KEY0)

    def test_authentication_is_required_before_a_full_command(self):
        session = Ntag424Session(FakeTransport())

        with pytest.raises(AuthenticationError):
            session.change_file_settings(0x02, b"\x40")


class TestSelect:
    def test_selects_the_ndef_file_separately_from_the_application(self):
        transport = FakeTransport()
        session = Ntag424Session(transport)

        session.select_ndef_file()

        assert transport.sent[-1].hex().upper() == "00A4000C02E10400"

    def test_selects_the_ndef_application(self):
        transport = FakeTransport()
        session = Ntag424Session(transport)

        session.select_ndef_app()

        assert transport.sent[0].hex().upper() == "00A4040C07D276000085010100"


class TestPlainWrite:
    def test_ndef_is_written_with_plain_iso_update_binary(self):
        """공장 상태 NDEF 파일은 쓰기가 free access다 — 보안 메시징으로 보내면 태그가 거부한다."""
        transport = FakeTransport()
        session = Ntag424Session(transport)

        session.update_binary(b"\x00\x03\xd1")

        apdu = transport.sent[-1]
        assert apdu[:4] == bytes([0x00, 0xD6, 0x00, 0x00])
        assert apdu[4] == 3
        assert apdu[5:8] == b"\x00\x03\xd1"

    def test_plain_write_needs_no_authentication(self):
        session = Ntag424Session(FakeTransport())
        session.update_binary(b"\x01")  # 인증하지 않았는데도 예외가 나지 않아야 한다

    def test_rejects_data_too_long_for_a_short_apdu(self):
        session = Ntag424Session(FakeTransport())
        with pytest.raises(ValueError):
            session.update_binary(bytes(256))


class TestFullCommands:
    def test_change_file_settings_advances_the_command_counter(self, fixed_rnd_a):
        session = Ntag424Session(FakeTransport())
        session.authenticate_ev2_first(0x00, KEY0)

        session.change_file_settings(0x02, bytes.fromhex("4000E0C1F121200000430000430000"))

        assert session.cmd_ctr == 1

    def test_change_file_settings_sends_a_5f_command_with_the_file_number(self, fixed_rnd_a):
        transport = FakeTransport()
        session = Ntag424Session(transport)
        session.authenticate_ev2_first(0x00, KEY0)

        session.change_file_settings(0x02, bytes.fromhex("4000E0C1F121200000430000430000"))

        apdu = transport.sent[-1]
        assert apdu[1] == 0x5F
        assert apdu[5] == 0x02  # CmdHeader = 파일 번호

    def test_change_key_sends_a_c4_command_with_the_key_number(self, fixed_rnd_a):
        transport = FakeTransport()
        session = Ntag424Session(transport)
        session.authenticate_ev2_first(0x00, KEY0)

        session.change_key(key_no=0x02, old_key=bytes(16), new_key=bytes(range(16)), new_key_version=1)

        apdu = transport.sent[-1]
        assert apdu[1] == 0xC4
        assert apdu[5] == 0x02


class TestGetFileSettings:
    """키 회전을 게이팅하려면 SDM이 실제로 켜졌는지 태그에 직접 물어봐야 한다."""

    def test_reports_sdm_disabled_on_a_factory_file(self):
        """공장 출고 설정(AN12196 §6.4): 0000E0EE000100 — FileOption 바이트가 00이다."""
        session = Ntag424Session(FakeTransport(file_settings=bytes.fromhex("0000E0EE000100")))
        assert session.is_sdm_enabled(0x02) is False

    def test_reports_sdm_enabled_from_the_second_byte_not_the_first(self):
        """응답은 FileType || FileOption || ... 순이다.

        첫 바이트를 FileOption으로 착각하면 SDM이 켜진 태그를 꺼진 것으로 읽는다.
        AN12196 Table 12의 실제 응답은 004300E0000100C1F121200000430000이다.
        """
        session = Ntag424Session(FakeTransport(file_settings=bytes.fromhex("004300E0000100C1")))
        assert session.is_sdm_enabled(0x02) is True

    def test_a_leading_0x40_file_type_does_not_count_as_sdm(self):
        # FileType 자리에 0x40이 있어도 SDM 판정에 쓰이면 안 된다.
        session = Ntag424Session(FakeTransport(file_settings=bytes.fromhex("400000E0000100")))
        assert session.is_sdm_enabled(0x02) is False

    def test_does_not_require_authentication(self):
        # AN12196 §6.4는 인증 전에 GetFileSettings를 부른다.
        session = Ntag424Session(FakeTransport(file_settings=bytes.fromhex("004300E0000100C1")))
        session.is_sdm_enabled(0x02)

    def test_rejects_a_response_too_short_to_hold_a_file_option(self):
        session = Ntag424Session(FakeTransport(file_settings=b"\x00"))
        with pytest.raises(CommandError):
            session.is_sdm_enabled(0x02)

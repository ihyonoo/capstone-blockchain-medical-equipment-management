import pytest

from tools.ntag.apdu import (
    GET_VERSION,
    ISO_SELECT_NDEF_APP,
    ISO_SELECT_NDEF_FILE,
    parse_uid_from_version,
)


class TestCommandBytes:
    def test_select_carries_the_ndef_aid_with_a_correct_length_byte(self):
        assert ISO_SELECT_NDEF_APP.hex().upper() == "00A4040C07D276000085010100"

    def test_selecting_the_ndef_file_is_separate_from_the_application(self):
        """앱을 골랐다고 그 안의 EF가 선택되지는 않는다. 파일을 안 고르면 쓰기가 6985로 거부된다."""
        assert ISO_SELECT_NDEF_FILE.hex().upper() == "00A4000C02E10400"
        assert ISO_SELECT_NDEF_FILE != ISO_SELECT_NDEF_APP

    def test_get_version_is_a_short_apdu(self):
        # 확장 APDU면 ACR122U 같은 리더에서 막힐 수 있다. 5바이트를 넘지 않아야 한다.
        assert len(GET_VERSION) == 5


class TestParseUidFromVersion:
    def test_takes_the_first_seven_bytes_of_the_third_frame(self):
        frames = [
            bytes.fromhex("04010101000216"),
            bytes.fromhex("04010101030116"),
            bytes.fromhex("04DE5F1EACC040" + "1122334455" + "6677"),
        ]
        assert parse_uid_from_version(frames) == "04DE5F1EACC040"

    def test_rejects_a_wrong_frame_count(self):
        with pytest.raises(ValueError):
            parse_uid_from_version([bytes(7), bytes(7)])

    def test_rejects_a_short_third_frame(self):
        with pytest.raises(ValueError):
            parse_uid_from_version([bytes(7), bytes(7), bytes(3)])

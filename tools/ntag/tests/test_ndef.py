"""SDM 플레이스홀더가 박힌 NDEF 파일과 미러 오프셋 계산.

오프셋은 손으로 적지 않고 실제 바이트열에서 찾아낸다 — URL 길이나 토큰이 바뀌면
하드코딩한 값은 조용히 어긋나고, 그 사실은 태그를 구운 뒤에야 드러난다.
"""

import pytest

from tools.ntag.ndef import UID_PLACEHOLDER_LEN, build_sdm_ndef_file


class TestBuildSdmNdefFile:
    def test_starts_with_a_two_byte_length_then_a_uri_record(self):
        data, _ = build_sdm_ndef_file("https://mediledger.xyz", "pump-001")

        nlen = int.from_bytes(data[0:2], "big")
        assert nlen == len(data) - 2
        assert data[2] == 0xD1  # MB|ME|SR, TNF=well-known
        assert data[3] == 0x01  # type length
        assert data[5] == 0x55  # 'U'
        assert data[6] == 0x04  # https:// 축약 코드

    def test_drops_the_scheme_because_the_abbreviation_byte_carries_it(self):
        data, _ = build_sdm_ndef_file("https://mediledger.xyz", "pump-001")
        assert b"mediledger.xyz/nfc/pump-001" in data
        assert b"https://" not in data

    def test_offsets_point_at_the_placeholders_in_the_actual_bytes(self):
        data, offsets = build_sdm_ndef_file("https://mediledger.xyz", "pump-001")

        assert data[offsets["uid"] : offsets["uid"] + UID_PLACEHOLDER_LEN] == b"0" * UID_PLACEHOLDER_LEN
        assert data[offsets["ctr"] : offsets["ctr"] + 6] == b"0" * 6
        assert data[offsets["cmac"] : offsets["cmac"] + 16] == b"0" * 16

    def test_offsets_shift_with_the_token_length(self):
        _, short = build_sdm_ndef_file("https://mediledger.xyz", "pump-001")
        _, long = build_sdm_ndef_file("https://mediledger.xyz", "defibrillator-001")
        assert long["uid"] > short["uid"]

    def test_the_query_string_order_is_uid_then_ctr_then_cmac(self):
        _, offsets = build_sdm_ndef_file("https://mediledger.xyz", "pump-001")
        assert offsets["uid"] < offsets["ctr"] < offsets["cmac"]

    def test_supports_a_plain_http_base_url(self):
        data, _ = build_sdm_ndef_file("http://localhost:5173", "pump-001")
        assert data[6] == 0x03  # http:// 축약 코드
        assert b"localhost:5173/nfc/pump-001" in data

    def test_rejects_a_base_url_without_a_supported_scheme(self):
        with pytest.raises(ValueError):
            build_sdm_ndef_file("ftp://example.com", "pump-001")

    def test_rejects_a_file_too_large_for_the_ndef_file(self):
        with pytest.raises(ValueError):
            build_sdm_ndef_file("https://" + "a" * 300, "pump-001")

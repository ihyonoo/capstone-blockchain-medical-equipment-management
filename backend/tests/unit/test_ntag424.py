import pytest

from backend.ntag424 import (
    derive_sdm_session_mac_key,
    derive_tag_key,
    parse_sdm_params,
    verify_cmac,
)

# NXP AN12196 Table 5 (§4.4.4.2.1 — CMACInputOffset == CMACOffset, 즉 zero length input).
# 이 설계가 태그에 넣는 구성과 같은 경우의 공식 벡터다.
# SV2 구성·세션키 파생·CMAC 절단을 한 묶음으로 고정해, 셋 중 하나가 틀렸는데
# 다른 하나의 오류에 가려지는 상황을 막는다.
AN12196_SDM_FILE_READ_KEY = bytes.fromhex("00000000000000000000000000000000")
AN12196_UID = bytes.fromhex("04DE5F1EACC040")
AN12196_READ_CTR = 61  # 와이어에서는 리틀엔디언 3바이트 3D0000
AN12196_SES_MAC_KEY = bytes.fromhex("3FB5F6E3A807A03D5E3570ACE393776F")
AN12196_SDM_MAC = bytes.fromhex("94EED9EE65337086")


class TestParseSdmParams:
    def test_parses_a_well_formed_tap(self):
        params = parse_sdm_params("04DE5F1EACC040", "00003D", "94EED9EE65337086")
        assert params is not None
        assert params.uid == AN12196_UID
        assert params.read_ctr == 61
        assert params.cmac == AN12196_SDM_MAC

    def test_reads_the_counter_as_big_endian(self):
        # URL은 ctr=000001로 MSB first, SV2에 들어갈 때만 리틀엔디언이 된다.
        # 둘을 헷갈리면 카운터 1이 65536으로 읽혀 리플레이 방지가 통째로 어긋난다.
        params = parse_sdm_params("04C767F2066180", "000001", "54A45B2C3A558765")
        assert params is not None
        assert params.read_ctr == 1

    def test_accepts_lowercase_hex(self):
        params = parse_sdm_params("04de5f1eacc040", "00003d", "94eed9ee65337086")
        assert params is not None
        assert params.uid == AN12196_UID

    @pytest.mark.parametrize(
        "uid, ctr, cmac",
        [
            (None, "00003D", "94EED9EE65337086"),
            ("04DE5F1EACC040", None, "94EED9EE65337086"),
            ("04DE5F1EACC040", "00003D", None),
            (None, None, None),
        ],
    )
    def test_rejects_missing_parameters(self, uid, ctr, cmac):
        assert parse_sdm_params(uid, ctr, cmac) is None

    @pytest.mark.parametrize(
        "uid, ctr, cmac",
        [
            ("04DE5F1EACC0", "00003D", "94EED9EE65337086"),  # UID 12자리
            ("04DE5F1EACC04000", "00003D", "94EED9EE65337086"),  # UID 16자리
            ("04DE5F1EACC040", "003D", "94EED9EE65337086"),  # 카운터 4자리
            ("04DE5F1EACC040", "00003D", "94EED9EE653370"),  # CMAC 14자리
            ("ZZDE5F1EACC040", "00003D", "94EED9EE65337086"),  # 비16진수
            ("04DE5F1EACC040", "00003D", ""),
        ],
    )
    def test_rejects_malformed_parameters(self, uid, ctr, cmac):
        assert parse_sdm_params(uid, ctr, cmac) is None

    def test_rejects_counter_zero(self):
        # 칩의 첫 탭이 1을 보고하므로 0은 와이어에 나올 수 없다.
        # tags.ntag_last_ctr의 초기값이 0이라, 0을 받아들이면 갓 바인딩된 태그에서
        # 카운터가 전진하지 않는 탭이 통과해 버린다.
        assert parse_sdm_params("04DE5F1EACC040", "000000", "94EED9EE65337086") is None


class TestDeriveTagKey:
    def test_is_deterministic(self):
        master = bytes(range(16))
        assert derive_tag_key(master, AN12196_UID) == derive_tag_key(master, AN12196_UID)

    def test_differs_per_uid(self):
        master = bytes(range(16))
        other_uid = bytes.fromhex("04C767F2066180")
        assert derive_tag_key(master, AN12196_UID) != derive_tag_key(master, other_uid)

    def test_differs_per_master_key(self):
        assert derive_tag_key(bytes(16), AN12196_UID) != derive_tag_key(bytes(range(16)), AN12196_UID)

    def test_returns_an_aes128_key(self):
        assert len(derive_tag_key(bytes(range(16)), AN12196_UID)) == 16


class TestDeriveSdmSessionMacKey:
    def test_matches_the_an12196_vector(self):
        key = derive_sdm_session_mac_key(AN12196_SDM_FILE_READ_KEY, AN12196_UID, AN12196_READ_CTR)
        assert key == AN12196_SES_MAC_KEY

    def test_changes_with_the_counter(self):
        a = derive_sdm_session_mac_key(AN12196_SDM_FILE_READ_KEY, AN12196_UID, 61)
        b = derive_sdm_session_mac_key(AN12196_SDM_FILE_READ_KEY, AN12196_UID, 62)
        assert a != b


class TestVerifyCmac:
    def test_accepts_the_an12196_vector(self):
        assert verify_cmac(AN12196_SES_MAC_KEY, b"", AN12196_SDM_MAC) is True

    def test_rejects_a_flipped_bit(self):
        tampered = bytes([AN12196_SDM_MAC[0] ^ 0x01]) + AN12196_SDM_MAC[1:]
        assert verify_cmac(AN12196_SES_MAC_KEY, b"", tampered) is False

    def test_rejects_the_untruncated_digest(self):
        # 절단 규칙은 홀수 인덱스 8바이트([1::2])다. 앞 8바이트를 그대로 쓰는
        # 흔한 오구현이 통과하지 않는지 못박는다.
        from cryptography.hazmat.primitives.ciphers import algorithms
        from cryptography.hazmat.primitives.cmac import CMAC

        c = CMAC(algorithms.AES(AN12196_SES_MAC_KEY))
        c.update(b"")
        assert verify_cmac(AN12196_SES_MAC_KEY, b"", c.finalize()[:8]) is False

    def test_rejects_wrong_length(self):
        assert verify_cmac(AN12196_SES_MAC_KEY, b"", AN12196_SDM_MAC[:7]) is False


class TestEndToEnd:
    def test_the_full_chain_reproduces_the_an12196_mac(self):
        # 파싱 → 세션키 → CMAC 검증까지 한 번에. 개별 단계가 맞아도 배선이
        # 틀리면 실물 태그를 비가역으로 개인화한 뒤에야 드러난다.
        params = parse_sdm_params("04DE5F1EACC040", "00003D", "94EED9EE65337086")
        assert params is not None
        session_key = derive_sdm_session_mac_key(AN12196_SDM_FILE_READ_KEY, params.uid, params.read_ctr)
        assert verify_cmac(session_key, b"", params.cmac) is True

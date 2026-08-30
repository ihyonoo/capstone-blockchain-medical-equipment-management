"""NXP AN12196 공식 벡터로 개인화 암호 연산을 고정한다.

키 회전은 비가역이라, 실물 태그에 쓰기 전에 이 벡터들이 전부 맞아야 한다.
"""

import pytest

from tools.ntag.crypto import (
    build_change_key_data,
    build_sdm_file_settings,
    command_iv,
    command_mac,
    derive_auth_session_keys,
    encrypt_command_data,
    jam_crc32,
    pad,
    rotate_left,
)

# --- AN12196 Table 14: AuthenticateEV2First with key 0x00 ---
KEY0 = bytes.fromhex("00000000000000000000000000000000")
RND_B = bytes.fromhex("B9E2FC789B64BF237CCCAA20EC7E6E48")
RND_A = bytes.fromhex("13C5DB8A5930439FC3DEF9A4C675360F")
SES_ENC = bytes.fromhex("1309C877509E5A215007FF0ED19CA564")
SES_MAC = bytes.fromhex("4C6626F5E72EA694202139295C7A7FC7")

# --- AN12196 Table 19: ChangeFileSettings, CommMode.FULL ---
TI = bytes.fromhex("9D00C4DF")
CFS_CMD_CTR = 1
CFS_CMD_DATA = bytes.fromhex("4000E0C1F121200000430000430000")
CFS_IV = bytes.fromhex("3E27082AB2ACC1EF55C57547934E9962")
CFS_ENCRYPTED = bytes.fromhex("61B6D97903566E84C3AE5274467E89EA")
CFS_MACT = bytes.fromhex("D799B7C1A0EF7A04")

# --- AN12196 Table 26: ChangeKey, case 1 (인증한 키와 다른 키를 바꾼다) ---
CK_SES_ENC = bytes.fromhex("4CF3CB41A22583A61E89B158D252FC53")
CK_SES_MAC = bytes.fromhex("5529860B2FC5FB6154B7F28361D30BF9")
CK_TI = bytes.fromhex("7614281A")
CK_CMD_CTR = 2
CK_NEW_KEY = bytes.fromhex("F3847D627727ED3BC9C4CC050489B966")
CK_IV = bytes.fromhex("307EDE1814707F30CFE603DD6CA62353")
CK_ENCRYPTED = bytes.fromhex("2CF362B7BF4311FF3BE1DAA295E8C68DE09050560D19B9E16C2393AE9CD1FAC7")
CK_MACT = bytes.fromhex("5D0CE20BCD1D06E6")


class TestRotateLeft:
    def test_moves_the_first_byte_to_the_end(self):
        assert rotate_left(RND_B).hex().upper() == "E2FC789B64BF237CCCAA20EC7E6E48B9"


class TestPad:
    def test_appends_0x80_then_zeroes_to_the_block_size(self):
        assert pad(b"\x01\x02").hex().upper() == "0102" + "80" + "00" * 13

    def test_adds_a_whole_block_when_already_aligned(self):
        # 정렬된 입력에도 패딩을 붙이지 않으면 수신측이 경계를 알 수 없다.
        assert len(pad(bytes(16))) == 32


class TestAuthSessionKeys:
    def test_matches_the_an12196_vector(self):
        ses_enc, ses_mac = derive_auth_session_keys(KEY0, RND_A, RND_B)
        assert ses_enc == SES_ENC
        assert ses_mac == SES_MAC

    def test_enc_and_mac_keys_differ(self):
        ses_enc, ses_mac = derive_auth_session_keys(KEY0, RND_A, RND_B)
        assert ses_enc != ses_mac


class TestCommModeFull:
    def test_command_iv_matches_the_change_file_settings_vector(self):
        assert command_iv(SES_ENC, TI, CFS_CMD_CTR) == CFS_IV

    def test_encryption_matches_the_change_file_settings_vector(self):
        assert encrypt_command_data(SES_ENC, CFS_IV, CFS_CMD_DATA) == CFS_ENCRYPTED

    def test_mac_matches_the_change_file_settings_vector(self):
        mact = command_mac(SES_MAC, 0x5F, CFS_CMD_CTR, TI, bytes([0x02]), CFS_ENCRYPTED)
        assert mact == CFS_MACT

    def test_the_counter_is_little_endian(self):
        # 0x0100과 0x0001을 뒤집으면 IV가 통째로 달라져 태그가 명령을 거부한다.
        assert command_iv(SES_ENC, TI, 1) != command_iv(SES_ENC, TI, 256)


class TestJamCrc32:
    def test_matches_the_change_key_vector(self):
        assert jam_crc32(CK_NEW_KEY).hex().upper() == "789DFADC"


class TestChangeKey:
    def test_key_data_matches_the_an12196_vector(self):
        # old key가 all-zero라 XOR 결과는 new key 그대로다.
        data = build_change_key_data(old_key=bytes(16), new_key=CK_NEW_KEY, new_key_version=1)
        assert data.hex().upper() == "F3847D627727ED3BC9C4CC050489B96601789DFADC" + "80" + "00" * 10

    def test_encrypted_key_data_matches_the_an12196_vector(self):
        iv = command_iv(CK_SES_ENC, CK_TI, CK_CMD_CTR)
        assert iv == CK_IV
        data = build_change_key_data(old_key=bytes(16), new_key=CK_NEW_KEY, new_key_version=1)
        assert encrypt_command_data(CK_SES_ENC, iv, data, already_padded=True) == CK_ENCRYPTED

    def test_mac_matches_the_an12196_vector(self):
        mact = command_mac(CK_SES_MAC, 0xC4, CK_CMD_CTR, CK_TI, bytes([0x02]), CK_ENCRYPTED)
        assert mact == CK_MACT

    def test_xors_the_old_key_when_it_is_not_zero(self):
        old = bytes(range(16))
        data = build_change_key_data(old_key=old, new_key=CK_NEW_KEY, new_key_version=1)
        assert data[:16] == bytes(a ^ b for a, b in zip(old, CK_NEW_KEY, strict=True))
        # CRC는 XOR 결과가 아니라 새 키 자체에 대해 계산한다.
        assert data[17:21] == jam_crc32(CK_NEW_KEY)


class TestSdmFileSettings:
    """우리가 실제로 쓸 설정 — 평문 UID·카운터 미러, CMAC 입력은 zero length."""

    def test_builds_the_plaintext_mirror_layout(self):
        data = build_sdm_file_settings(uid_offset=0x20, read_ctr_offset=0x30, mac_offset=0x43)

        assert data[0] == 0x40  # FileOption: SDM 켬 + CommMode plain
        assert data[1:3] == bytes.fromhex("00E0")  # 읽기는 free, 나머지는 key 0
        assert data[3] == 0xC1  # UID 미러 + 카운터 미러 + ASCII
        # SDMMetaRead=E(free, 평문 미러) · SDMFileRead=2 · SDMCtrRet=F(비활성)
        assert data[4:6] == bytes.fromhex("FFE2")

    def test_offsets_are_three_byte_little_endian_in_spec_order(self):
        data = build_sdm_file_settings(uid_offset=0x20, read_ctr_offset=0x30, mac_offset=0x43)

        # 순서: UID → ReadCtr → MACInput → MAC
        assert data[6:9] == bytes.fromhex("200000")
        assert data[9:12] == bytes.fromhex("300000")
        assert data[12:15] == bytes.fromhex("430000")
        assert data[15:18] == bytes.fromhex("430000")

    def test_mac_input_equals_mac_offset(self):
        """이 둘이 같아야 CMAC 입력이 zero length가 된다(AN12196 §4.4.4.2.1)."""
        data = build_sdm_file_settings(uid_offset=1, read_ctr_offset=2, mac_offset=0x51)
        assert data[12:15] == data[15:18]

    def test_rejects_an_offset_that_does_not_fit_three_bytes(self):
        with pytest.raises(ValueError):
            build_sdm_file_settings(uid_offset=0x1000000, read_ctr_offset=0, mac_offset=0)

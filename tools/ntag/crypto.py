"""NTAG 424 DNA 개인화에 쓰는 암호 연산. 리더 I/O는 없다.

전부 NXP AN12196 기준이며, 벡터는 tests/test_crypto.py가 고정하고 있다.
키 회전이 비가역이라 여기서 한 글자만 틀려도 태그가 영구히 못 쓰게 된다.
"""

import zlib

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.cmac import CMAC

BLOCK = 16
NULL_IV = bytes(BLOCK)

# 인증 세션키 파생 벡터(AN12196 §6.6). 암호화용과 MAC용이 프리픽스만 다르다.
SV1_PREFIX = bytes.fromhex("A55A00010080")
SV2_PREFIX = bytes.fromhex("5AA500010080")

# CommMode.FULL의 명령 IV 유도에 쓰는 접두사.
IV_COMMAND_PREFIX = bytes.fromhex("A55A")


def _aes_cbc_encrypt(key: bytes, iv: bytes, data: bytes) -> bytes:
    encryptor = Cipher(algorithms.AES(key), modes.CBC(iv)).encryptor()
    return encryptor.update(data) + encryptor.finalize()


def _aes_cbc_decrypt(key: bytes, iv: bytes, data: bytes) -> bytes:
    decryptor = Cipher(algorithms.AES(key), modes.CBC(iv)).decryptor()
    return decryptor.update(data) + decryptor.finalize()


def _aes_cmac(key: bytes, message: bytes) -> bytes:
    ctx = CMAC(algorithms.AES(key))
    ctx.update(message)
    return ctx.finalize()


def pad(data: bytes) -> bytes:
    """0x80 뒤에 0x00을 채워 블록 크기에 맞춘다. 이미 정렬돼 있어도 한 블록을 더 붙인다."""
    return data + b"\x80" + bytes((-len(data) - 1) % BLOCK)


def rotate_left(data: bytes) -> bytes:
    """첫 바이트를 뒤로 보낸다. 인증에서 RndB'를 만들 때 쓴다."""
    return data[1:] + data[:1]


def decrypt_rnd_b(key: bytes, encrypted: bytes) -> bytes:
    """AuthenticateEV2First 1단계 응답에서 RndB를 꺼낸다."""
    return _aes_cbc_decrypt(key, NULL_IV, encrypted)


def derive_auth_session_keys(key: bytes, rnd_a: bytes, rnd_b: bytes) -> tuple[bytes, bytes]:
    """(KSesAuthENC, KSesAuthMAC)를 만든다 — AN12196 §6.6 step 25~28.

    SV = prefix || RndA[0:2] || (RndA[2:8] XOR RndB[0:6]) || RndB[6:16] || RndA[8:16]
    """
    mixed = bytes(a ^ b for a, b in zip(rnd_a[2:8], rnd_b[0:6], strict=True))
    tail = rnd_a[0:2] + mixed + rnd_b[6:16] + rnd_a[8:16]
    return _aes_cmac(key, SV1_PREFIX + tail), _aes_cmac(key, SV2_PREFIX + tail)


def command_iv(ses_enc: bytes, ti: bytes, cmd_ctr: int) -> bytes:
    """CommMode.FULL 명령의 IV. 카운터는 리틀엔디언 2바이트다."""
    block = IV_COMMAND_PREFIX + ti + cmd_ctr.to_bytes(2, "little") + bytes(8)
    return _aes_cbc_encrypt(ses_enc, NULL_IV, block)


def encrypt_command_data(ses_enc: bytes, iv: bytes, data: bytes, *, already_padded: bool = False) -> bytes:
    return _aes_cbc_encrypt(ses_enc, iv, data if already_padded else pad(data))


def command_mac(ses_mac: bytes, cmd: int, cmd_ctr: int, ti: bytes, header: bytes, enc_data: bytes) -> bytes:
    """MACt(KSesAuthMAC, Cmd || CmdCtr || TI || CmdHeader || 암호화된 데이터) — 홀수 바이트 8개."""
    message = bytes([cmd]) + cmd_ctr.to_bytes(2, "little") + ti + header + enc_data
    return _aes_cmac(ses_mac, message)[1::2]


def response_mac(ses_mac: bytes, cmd_ctr: int, ti: bytes, enc_response: bytes = b"") -> bytes:
    """응답 무결성 검증용. 상태(0x00) || CmdCtr+1 || TI || 응답 데이터."""
    message = bytes([0x00]) + (cmd_ctr + 1).to_bytes(2, "little") + ti + enc_response
    return _aes_cmac(ses_mac, message)[1::2]


def jam_crc32(data: bytes) -> bytes:
    """ChangeKey가 요구하는 CRC32 변종(zlib CRC32의 비트 반전), 리틀엔디언 4바이트."""
    return ((~zlib.crc32(data)) & 0xFFFFFFFF).to_bytes(4, "little")


def build_change_key_data(*, old_key: bytes, new_key: bytes, new_key_version: int) -> bytes:
    """인증한 키와 '다른' 키를 바꿀 때의 평문(AN12196 §6.16.1, case 1).

    CRC32는 XOR 결과가 아니라 새 키 자체에 대해 계산한다 — 태그가 XOR을 푼 뒤 대조하기 때문이다.
    """
    xored = bytes(a ^ b for a, b in zip(old_key, new_key, strict=True))
    return pad(xored + bytes([new_key_version]) + jam_crc32(new_key))


def build_sdm_file_settings(*, uid_offset: int, read_ctr_offset: int, mac_offset: int) -> bytes:
    """ChangeFileSettings의 평문 CmdData — 평문 UID·카운터 미러 구성.

    SDMMetaRead를 free(0xE)로 두는 것이 평문 미러를 고르는 스위치다. 암호화 PICC를 쓰면
    서버가 UID를 알기 전에 키가 필요해져, UID로 키를 파생하는 이 설계와 순환이 생긴다.

    SDMMACInputOffset을 SDMMACOffset과 같게 둬서 CMAC 입력을 zero length로 만든다
    (AN12196 §4.4.4.2.1). UID와 카운터는 이미 세션키에 들어가므로 위조를 막는 데 충분하다.
    """
    for name, value in (("uid_offset", uid_offset), ("read_ctr_offset", read_ctr_offset), ("mac_offset", mac_offset)):
        if not 0 <= value <= 0xFFFFFF:
            raise ValueError(f"{name}는 3바이트에 담겨야 한다: {value}")

    file_option = 0x40  # SDM 활성(bit6) + CommMode plain
    access_rights = bytes.fromhex("00E0")  # Read=free, Write/ReadWrite/Change=key 0
    sdm_options = 0xC1  # UID 미러 + SDMReadCtr 미러 + ASCII 인코딩
    sdm_access_rights = bytes([0xFF, 0xE2])  # RFU=F, CtrRet=F(비활성), MetaRead=E(free), FileRead=2

    def off(value: int) -> bytes:
        return value.to_bytes(3, "little")

    # 순서는 데이터시트 고정: UID → ReadCtr → MACInput → MAC
    return (
        bytes([file_option])
        + access_rights
        + bytes([sdm_options])
        + sdm_access_rights
        + off(uid_offset)
        + off(read_ctr_offset)
        + off(mac_offset)
        + off(mac_offset)
    )

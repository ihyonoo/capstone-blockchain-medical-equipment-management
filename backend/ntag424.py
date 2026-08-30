"""NTAG 424 DNA SDM(SUN) 탭 검증에 쓰는 순수 암호 함수 모음.

I/O가 없다 — DB도 HTTP도 건드리지 않는다. 탭 파이프라인은 backend/nfc_tap.py에 있다.
알고리즘 근거는 NXP AN12196, 검증 벡터는 backend/tests/unit/test_ntag424.py 참고.
"""

import re
from hmac import compare_digest
from typing import NamedTuple

from cryptography.hazmat.primitives.ciphers import algorithms
from cryptography.hazmat.primitives.cmac import CMAC

UID_RE = re.compile(r"\A[0-9A-Fa-f]{14}\Z")  # 7바이트
CTR_RE = re.compile(r"\A[0-9A-Fa-f]{6}\Z")  # 3바이트
CMAC_RE = re.compile(r"\A[0-9A-Fa-f]{16}\Z")  # 절단된 8바이트

# AN12196 §4.3 — SDM 세션키 파생 벡터. MAC 키는 SV2에서 나온다.
SV2_PREFIX = b"\x3c\xc3\x00\x01\x00\x80"

# 마스터키에서 태그별 키를 뽑을 때 쓰는 라벨. AN10922 방식(0x01 ‖ 파생입력)이며
# 파생 입력은 1 + 7 + 19 = 27바이트로 31바이트 한도 안에 든다.
# 태그는 이 값을 모른다 — 개인화 도구와 서버만 합의하면 된다.
DIVERSIFY_LABEL = b"locuvera-ntag424-v1"


class SdmParams(NamedTuple):
    uid: bytes  # 7바이트
    read_ctr: int  # 1 .. 0xFFFFFF
    cmac: bytes  # 8바이트


def _aes_cmac(key: bytes, message: bytes) -> bytes:
    ctx = CMAC(algorithms.AES(key))
    ctx.update(message)
    return ctx.finalize()


def parse_sdm_params(uid: str | None, ctr: str | None, cmac: str | None) -> SdmParams | None:
    """URL 쿼리의 SDM 파라미터를 검증해 파싱한다. 하나라도 어긋나면 None."""
    if uid is None or ctr is None or cmac is None:
        return None
    if not (UID_RE.match(uid) and CTR_RE.match(ctr) and CMAC_RE.match(cmac)):
        return None

    # URL의 카운터는 MSB first다. SV2에 넣을 때만 리틀엔디언으로 바꾼다.
    read_ctr = int(ctr, 16)
    # 칩의 첫 탭이 1을 보고하므로 0은 와이어에 나올 수 없다. tags.ntag_last_ctr의
    # 초기값이 0이라, 0을 받아들이면 카운터가 전진하지 않는 탭이 통과한다.
    if read_ctr == 0:
        return None

    return SdmParams(uid=bytes.fromhex(uid), read_ctr=read_ctr, cmac=bytes.fromhex(cmac))


def derive_tag_key(master_key: bytes, uid: bytes) -> bytes:
    """마스터키와 UID로 태그별 SDMFileReadKey를 파생한다. 어디에도 저장하지 않는다."""
    return _aes_cmac(master_key, b"\x01" + uid + DIVERSIFY_LABEL)


def derive_sdm_session_mac_key(tag_key: bytes, uid: bytes, read_ctr: int) -> bytes:
    """AN12196 §4.3: KSesSDMFileReadMAC = MAC(KSDMFileRead; SV2)."""
    sv2 = SV2_PREFIX + uid + read_ctr.to_bytes(3, "little")
    return _aes_cmac(tag_key, sv2)


def verify_cmac(session_mac_key: bytes, mac_input: bytes, provided: bytes) -> bool:
    """AN12196 §4.4.4.2.1: MACt는 전체 CMAC의 홀수 인덱스 8바이트다.

    mac_input이 빈 것은 태그를 SDMMACInputOffset == SDMMACOffset으로 설정했기 때문이다.
    """
    expected = _aes_cmac(session_mac_key, mac_input)[1::2]
    return compare_digest(expected, provided)

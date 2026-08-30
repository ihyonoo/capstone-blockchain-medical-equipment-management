"""NTAG 424 DNA와 주고받는 APDU 조립·응답 파싱. 리더 I/O는 여기 없다.

명령 바이트는 NXP AN12196 기준이다. 전부 짧은 ISO 7816 wrapped APDU라
확장 APDU를 지원하지 않는 PC/SC 리더에서도 그대로 오간다.
"""

# ISO SelectFile — NDEF 애플리케이션
AID_NDEF = bytes.fromhex("D2760000850101")
ISO_SELECT_NDEF_APP = bytes([0x00, 0xA4, 0x04, 0x0C, len(AID_NDEF)]) + AID_NDEF + bytes([0x00])

# PC/SC 표준 UID 조회. 리더 펌웨어가 답하므로 태그와의 APDU 교환이 되는지는 증명하지 못한다.
PCSC_GET_UID = bytes([0xFF, 0xCA, 0x00, 0x00, 0x00])

# DESFire 계열 GetVersion. 인증이 필요 없고 3프레임으로 나뉘어 오므로,
# 이게 끝까지 오면 리더가 ISO-DEP 위에서 태그와 실제로 대화한다는 뜻이다.
# ISO UPDATE BINARY. 공장 상태의 NDEF 파일은 쓰기가 free access라 보안 메시징이 통하지 않는다 —
# 인증 없이 평문으로 써야 한다(AN12196 §6.8.1).
ISO_UPDATE_BINARY_INS = 0xD6
MAX_SHORT_APDU_DATA = 0xFF

GET_VERSION = bytes([0x90, 0x60, 0x00, 0x00, 0x00])
GET_ADDITIONAL_FRAME = bytes([0x90, 0xAF, 0x00, 0x00, 0x00])

SW_ISO_OK = "9000"
SW_OK = "9100"
SW_ADDITIONAL_FRAME = "91AF"


def parse_uid_from_version(frames: list[bytes]) -> str:
    """GetVersion 3번째 프레임 앞 7바이트가 UID다."""
    if len(frames) != 3:
        raise ValueError(f"GetVersion은 3프레임이어야 한다(받은 프레임 {len(frames)}개)")
    third = frames[2]
    if len(third) < 7:
        raise ValueError(f"3번째 프레임이 짧다: {third.hex().upper()}")
    return third[:7].hex().upper()

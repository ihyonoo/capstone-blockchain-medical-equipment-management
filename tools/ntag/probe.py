"""PC/SC 리더로 NTAG 424 DNA와 APDU가 실제로 오가는지 확인하는 읽기 전용 스파이크.

태그에 아무것도 쓰지 않는다. NDEF 애플리케이션을 SELECT하고 GetVersion으로 UID만 읽는다.
개인화(ChangeFileSettings/ChangeKey)를 구현하기 전에 이게 통과해야 한다 — ACR122U는
PN532 앞에 USB-CCID 컨트롤러가 있어 칩 고유 기능을 다 쓰지는 못하지만, 여기서 쓰는 건
전부 짧은 ISO 7816 wrapped APDU라 표준 PC/SC 경로로 오간다.

실행:
    python -m tools.ntag.probe
"""

import sys

try:
    from tools.ntag.apdu import (
        GET_ADDITIONAL_FRAME,
        GET_VERSION,
        ISO_SELECT_NDEF_APP,
        PCSC_GET_UID,
        SW_ADDITIONAL_FRAME,
        SW_ISO_OK,
        SW_OK,
        parse_uid_from_version,
    )
except ModuleNotFoundError:
    from apdu import (
        GET_ADDITIONAL_FRAME,
        GET_VERSION,
        ISO_SELECT_NDEF_APP,
        PCSC_GET_UID,
        SW_ADDITIONAL_FRAME,
        SW_ISO_OK,
        SW_OK,
        parse_uid_from_version,
    )


def _send(connection, apdu: bytes) -> tuple[bytes, str]:
    data, sw1, sw2 = connection.transmit(list(apdu))
    return bytes(data), f"{sw1:02X}{sw2:02X}"


def main() -> int:
    try:
        from smartcard.System import readers
    except ModuleNotFoundError:
        print("pyscard가 없다. tools/ntag/requirements.txt를 설치할 것.", file=sys.stderr)
        return 2

    available = readers()
    if not available:
        print("PC/SC 리더를 찾지 못했다. 리더가 꽂혀 있는지 확인할 것.", file=sys.stderr)
        return 2

    reader = available[0]
    print(f"리더: {reader}")

    connection = reader.createConnection()
    try:
        connection.connect()
    except Exception as exc:
        print(f"카드에 연결하지 못했다 — 태그를 리더에 올려둘 것. ({exc})", file=sys.stderr)
        return 2

    # 1) 리더 펌웨어가 답하는 UID. 태그와의 APDU 교환을 증명하지는 못한다.
    pcsc_uid, sw = _send(connection, PCSC_GET_UID)
    print(f"[1] PC/SC GET UID       {pcsc_uid.hex().upper() or '-'}  (SW={sw})")

    # 2) NDEF 애플리케이션 SELECT — 여기서부터가 태그와의 실제 대화다.
    _, sw = _send(connection, ISO_SELECT_NDEF_APP)
    print(f"[2] SELECT NDEF app     SW={sw}")
    if sw != SW_ISO_OK:
        print("    NDEF 애플리케이션을 선택하지 못했다. NTAG 424 DNA가 맞는지 확인할 것.", file=sys.stderr)
        return 1

    # 3) GetVersion — 인증 없이 3프레임으로 오간다. 끝까지 오면 ISO-DEP APDU 교환이 된다는 뜻.
    frames: list[bytes] = []
    data, sw = _send(connection, GET_VERSION)
    frames.append(data)
    while sw == SW_ADDITIONAL_FRAME:
        data, sw = _send(connection, GET_ADDITIONAL_FRAME)
        frames.append(data)
    print(f"[3] GetVersion          {len(frames)}프레임  (마지막 SW={sw})")

    if sw != SW_OK:
        print(f"    GetVersion이 {sw}로 끝났다. 개인화 APDU도 통하지 않을 가능성이 높다.", file=sys.stderr)
        return 1

    try:
        uid = parse_uid_from_version(frames)
    except ValueError as exc:
        print(f"    UID를 읽지 못했다: {exc}", file=sys.stderr)
        return 1

    print(f"[4] 태그 UID            {uid}")
    print()
    print("통과 — 이 리더로 NTAG 424 DNA와 APDU가 오간다. 개인화 구현으로 넘어가도 된다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

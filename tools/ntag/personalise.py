"""NTAG 424 DNA 태그를 개인화한다. USB PC/SC 리더가 꽂힌 로컬 PC에서만 돌린다.

순서가 중요하다:
  1. UID 읽기            — 아무것도 쓰지 않는다
  2. 바인딩 등록          — 되돌릴 수 있다. 실패해도 태그는 백지 상태로 남는다
  3. NDEF 기록 + SDM 설정 — 아직 공장 키라 몇 번이든 다시 할 수 있다
  4. 라이브 탭 검증       — 공장 키로 만든 CMAC이 서버 계산과 맞는지 확인한다
  5. 키 회전             — 비가역. 4번이 통과한 뒤에만 한다

먼저 `python -m tools.ntag.probe`로 리더 호환성을 확인할 것.

실행:
    python -m tools.ntag.personalise --tag-id <tag_id> --token pump-001
"""

import argparse
import getpass
import os
import sys

from backend.ntag424 import derive_tag_key

try:
    from tools.ntag.apdu import GET_ADDITIONAL_FRAME, GET_VERSION, SW_ADDITIONAL_FRAME, SW_OK, parse_uid_from_version
    from tools.ntag.crypto import build_sdm_file_settings
    from tools.ntag.ndef import build_sdm_ndef_file
    from tools.ntag.session import AuthenticationError, CommandError, Ntag424Session
except ModuleNotFoundError:
    from apdu import GET_ADDITIONAL_FRAME, GET_VERSION, SW_ADDITIONAL_FRAME, SW_OK, parse_uid_from_version
    from crypto import build_sdm_file_settings
    from ndef import build_sdm_ndef_file
    from session import AuthenticationError, CommandError, Ntag424Session

FACTORY_KEY = bytes(16)
NDEF_FILE_NO = 0x02
APP_MASTER_KEY_NO = 0x00
SDM_FILE_READ_KEY_NO = 0x02
NEW_KEY_VERSION = 0x01


def derive_key_for(master_key: bytes, uid_hex: str) -> bytes:
    """서버와 같은 파생을 쓴다 — 복제하지 않고 backend.ntag424를 그대로 부른다."""
    return derive_tag_key(master_key, bytes.fromhex(uid_hex))


class PcscTransport:
    def __init__(self, connection):
        self._connection = connection

    def transmit(self, apdu: bytes) -> tuple[bytes, str]:
        data, sw1, sw2 = self._connection.transmit(list(apdu))
        return bytes(data), f"{sw1:02X}{sw2:02X}"


def read_uid(session: Ntag424Session) -> str:
    frames: list[bytes] = []
    data, sw = session.transport.transmit(GET_VERSION)
    frames.append(data)
    while sw == SW_ADDITIONAL_FRAME:
        data, sw = session.transport.transmit(GET_ADDITIONAL_FRAME)
        frames.append(data)
    if sw != SW_OK:
        raise CommandError(f"GetVersion이 {sw}로 끝났다")
    return parse_uid_from_version(frames)


def detect_state(transport, tag_key: bytes) -> str:
    """어느 키로 인증되는지로 태그가 어디까지 개인화됐는지 판별한다.

    인증은 매번 새 세션을 열므로, 실패해도 태그에 남는 흔적이 없다.
    """
    for state, key in (("factory", FACTORY_KEY), ("rotated", tag_key)):
        probe = Ntag424Session(transport)
        try:
            probe.select_ndef_app()
            probe.authenticate_ev2_first(APP_MASTER_KEY_NO, key)
            return state
        except (AuthenticationError, CommandError):
            continue
    return "unknown"


def _login(api_base: str, username: str) -> str:
    import requests

    password = getpass.getpass(f"{username} 비밀번호: ")
    response = requests.post(f"{api_base}/auth/login", json={"username": username, "password": password}, timeout=10)
    response.raise_for_status()
    return response.json()["token"]


def _bind(api_base: str, token: str, tag_id: str, uid: str) -> None:
    import requests

    response = requests.post(
        f"{api_base}/admin/ntag-bindings",
        json={"tag_id": tag_id, "ntag_uid": uid},
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    if response.status_code == 409:
        raise SystemExit(f"이미 다른 장비에 바인딩된 UID다: {uid}")
    response.raise_for_status()


def main() -> int:
    parser = argparse.ArgumentParser(description="NTAG 424 DNA 태그 개인화")
    parser.add_argument("--tag-id", required=True, help="바인딩할 장비의 tag_id")
    parser.add_argument("--token", required=True, help="URL 경로에 들어갈 장비 토큰 (예: pump-001)")
    parser.add_argument("--base-url", default="https://mediledger.xyz", help="태그에 기록할 공개 URL")
    parser.add_argument("--api", default="http://localhost:8000", help="백엔드 주소")
    parser.add_argument("--admin", default="admin", help="관리자 계정")
    parser.add_argument("--rotate-key", action="store_true", help="키 회전까지 수행한다(비가역)")
    args = parser.parse_args()

    master_hex = os.getenv("NTAG_MASTER_KEY", "").strip()
    if len(master_hex) != 32:
        print("NTAG_MASTER_KEY(hex 32자)가 필요하다.", file=sys.stderr)
        return 2
    master_key = bytes.fromhex(master_hex)

    try:
        from smartcard.System import readers
    except ModuleNotFoundError:
        print("pyscard가 없다. tools/ntag/requirements.txt를 설치할 것.", file=sys.stderr)
        return 2

    available = readers()
    if not available:
        print("PC/SC 리더를 찾지 못했다.", file=sys.stderr)
        return 2

    connection = available[0].createConnection()
    connection.connect()
    transport = PcscTransport(connection)

    session = Ntag424Session(transport)
    session.select_ndef_app()
    uid = read_uid(session)
    tag_key = derive_key_for(master_key, uid)
    print(f"태그 UID: {uid}")

    state = detect_state(transport, tag_key)
    print(f"태그 상태: {state}")
    if state == "unknown":
        print("공장 키로도 파생 키로도 인증되지 않는다. 이 도구로는 복구할 수 없다.", file=sys.stderr)
        return 1
    if state == "rotated":
        print("이미 키가 회전된 태그다. 바인딩만 확인하고 끝낸다.")

    auth_token = _login(args.api, args.admin)
    _bind(args.api, auth_token, args.tag_id, uid)
    print(f"바인딩 등록 완료: {args.tag_id} ↔ {uid}")

    if state == "rotated":
        return 0

    ndef_file, offsets = build_sdm_ndef_file(args.base_url, args.token)
    session = Ntag424Session(transport)
    session.select_ndef_app()
    session.authenticate_ev2_first(APP_MASTER_KEY_NO, FACTORY_KEY)
    session.write_data(NDEF_FILE_NO, 0, ndef_file)
    print(f"NDEF 기록 완료 ({len(ndef_file)}바이트), 미러 오프셋 {offsets}")

    session.change_file_settings(
        NDEF_FILE_NO,
        build_sdm_file_settings(uid_offset=offsets["uid"], read_ctr_offset=offsets["ctr"], mac_offset=offsets["cmac"]),
    )
    print("SDM 설정 완료 — 지금 태그를 폰으로 태깅하면 URL이 채워진 채 열린다.")

    if not args.rotate_key:
        print()
        print("키 회전은 하지 않았다. 태깅해서 URL이 제대로 채워지는지 먼저 확인할 것.")
        print("확인이 끝나면 --rotate-key를 붙여 다시 실행한다. 회전은 되돌릴 수 없다.")
        return 0

    session.change_key(
        key_no=SDM_FILE_READ_KEY_NO,
        old_key=FACTORY_KEY,
        new_key=tag_key,
        new_key_version=NEW_KEY_VERSION,
    )
    print("키 회전 완료. 이 태그는 이제 이 서버의 마스터키로만 검증된다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""NTAG 424 DNA 태그를 개인화한다. USB PC/SC 리더가 꽂힌 로컬 PC에서만 돌린다.

두 번에 나눠 실행한다. 키 회전이 비가역이라, 되돌릴 수 있는 것을 전부 끝내고
사람이 실제 태깅으로 확인한 뒤에만 회전한다.

  1회차 (기본)      UID 읽기 → 바인딩 등록 → NDEF 기록 → SDM 설정
                    여기까지는 태그가 공장 키를 그대로 들고 있어 몇 번이든 다시 할 수 있다.
  --- 사람이 폰으로 태깅해 URL이 채워지는지 확인 ---
  2회차 (--rotate-key)  SDM이 켜졌는지 태그에 묻고, 서버에 성공한 탭 기록이 있는지
                        확인한 뒤에만 키 회전

먼저 `python -m tools.ntag.probe`로 리더 호환성을 확인할 것.
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
# 실제로 회전하는 키. 상태 판별도 반드시 이 키로 해야 한다 —
# 키 0은 공장값 그대로 두므로, 키 0으로 물으면 완성된 태그도 factory로 보인다.
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
    """회전 대상 키로 인증을 시도해 어디까지 진행됐는지 판별한다.

    인증은 매번 새 세션을 열고, 실패해도 태그에 남는 흔적이 없다.
    """
    for state, key in (("factory", FACTORY_KEY), ("rotated", tag_key)):
        probe = Ntag424Session(transport)
        try:
            probe.select_ndef_app()
            probe.authenticate_ev2_first(SDM_FILE_READ_KEY_NO, key)
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


def _detail_of(response) -> str:
    """오류 응답에서 사람이 읽을 메시지를 꺼낸다. JSON이 아닐 수도 있다."""
    try:
        return str(response.json().get("detail", response.text))
    except ValueError:
        return response.text[:200]


def _bind(api_base: str, auth_token: str, tag_id: str, uid: str) -> tuple[str, int]:
    """UID를 장비에 바인딩하고 서버가 알려준 장비 토큰을 받아온다.

    토큰을 인자로 받지 않는 이유는, 오타 하나로 UID와 토큰이 서로 다른 장비를 가리키는
    태그가 구워지기 때문이다. 그런 태그는 교차검증에 항상 실패하는데, 그 사실은
    비가역인 키 회전이 끝난 뒤에야 드러난다.
    """
    import requests

    response = requests.post(
        f"{api_base}/admin/ntag-bindings",
        json={"tag_id": tag_id, "ntag_uid": uid},
        headers={"Authorization": f"Bearer {auth_token}"},
        timeout=10,
    )
    if response.status_code == 409:
        raise SystemExit(f"이미 다른 장비에 바인딩된 UID다: {uid}")
    if response.status_code == 400:
        raise SystemExit(f"바인딩할 수 없다: {_detail_of(response)}")
    response.raise_for_status()

    # 여기서 얻는 값으로 태그를 굽고 회전 여부를 정한다. 응답이 예상과 다르면
    # KeyError를 흘리지 말고 무엇이 잘못됐는지 알려주고 멈춘다.
    try:
        body = response.json()
        return str(body["nfc_token"]), int(body["ntag_last_ctr"])
    except (ValueError, TypeError, KeyError):
        raise SystemExit(f"바인딩 응답을 이해할 수 없다: {response.text[:200]}") from None


def _connect_reader():
    try:
        from smartcard.System import readers
    except ModuleNotFoundError:
        raise SystemExit("pyscard가 없다. tools/ntag/requirements.txt를 설치할 것.") from None

    available = readers()
    if not available:
        raise SystemExit("PC/SC 리더를 찾지 못했다.")
    connection = available[0].createConnection()
    connection.connect()
    return PcscTransport(connection)


def main() -> int:
    parser = argparse.ArgumentParser(description="NTAG 424 DNA 태그 개인화")
    parser.add_argument("--tag-id", required=True, help="바인딩할 장비의 tag_id")
    parser.add_argument("--base-url", default="https://mediledger.xyz", help="태그에 기록할 공개 URL")
    parser.add_argument("--api", default="http://localhost:8000", help="백엔드 주소")
    parser.add_argument("--admin", default="admin", help="관리자 계정")
    parser.add_argument(
        "--rotate-key",
        action="store_true",
        help="키 회전만 수행한다(비가역). 1회차를 마치고 폰으로 확인한 뒤에 쓴다.",
    )
    args = parser.parse_args()

    master_hex = os.getenv("NTAG_MASTER_KEY", "").strip()
    if len(master_hex) != 32:
        print("NTAG_MASTER_KEY(hex 32자)가 필요하다.", file=sys.stderr)
        return 2
    master_key = bytes.fromhex(master_hex)

    transport = _connect_reader()
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

    auth_token = _login(args.api, args.admin)
    nfc_token, last_ctr = _bind(args.api, auth_token, args.tag_id, uid)
    print(f"바인딩 완료: {args.tag_id} ↔ {uid} (토큰 {nfc_token})")

    if state == "rotated":
        print("이미 키가 회전된 태그다. 더 할 일이 없다.")
        return 0

    probe = Ntag424Session(transport)
    probe.select_ndef_app()
    sdm_ready = probe.is_sdm_enabled(NDEF_FILE_NO)

    if args.rotate_key:
        if not sdm_ready:
            print("SDM이 아직 설정되지 않았다. --rotate-key 없이 먼저 실행할 것.", file=sys.stderr)
            return 1
        # SDM이 켜졌다는 것과 그 태그가 만든 URL이 실제로 통과한다는 것은 다르다.
        # 카운터가 0보다 커야 서버가 검증에 성공한 탭이 최소 한 번 있었다는 뜻이고,
        # 그때에야 비가역인 회전을 걸어도 된다.
        if last_ctr == 0:
            print(
                "이 태그로 성공한 탭 기록이 없다. 폰으로 태깅해 URL이 열리는지 먼저 확인할 것.",
                file=sys.stderr,
            )
            return 1

        session = Ntag424Session(transport)
        session.select_ndef_app()
        session.authenticate_ev2_first(APP_MASTER_KEY_NO, FACTORY_KEY)
        session.change_key(
            key_no=SDM_FILE_READ_KEY_NO,
            old_key=FACTORY_KEY,
            new_key=tag_key,
            new_key_version=NEW_KEY_VERSION,
        )
        print("키 회전 완료. 이 태그는 이제 이 서버의 마스터키로만 검증된다.")
        return 0

    if sdm_ready:
        # SDM 설정이 들어가면 NDEF 쓰기가 키 0 보호로 바뀌어 평문 재기록이 거부된다.
        # 이미 준비된 태그를 다시 굽지 않고, 다음에 할 일만 알려준다.
        print("이 태그는 이미 NDEF와 SDM 설정이 끝나 있다.")
        if last_ctr == 0:
            print("아직 성공한 탭이 없다. 폰으로 태깅해 URL이 열리는지 확인할 것.")
        else:
            print(f"성공한 탭이 확인된다(카운터 {last_ctr}). --rotate-key로 회전하면 끝난다.")
        return 0

    ndef_file, offsets = build_sdm_ndef_file(args.base_url, nfc_token)
    # 공장 상태의 NDEF 파일은 쓰기가 free access라 인증 없이 평문으로 쓴다.
    session = Ntag424Session(transport)
    session.select_ndef_app()
    session.update_binary(ndef_file)
    print(f"NDEF 기록 완료 ({len(ndef_file)}바이트), 미러 오프셋 {offsets}")

    session.authenticate_ev2_first(APP_MASTER_KEY_NO, FACTORY_KEY)
    session.change_file_settings(
        NDEF_FILE_NO,
        build_sdm_file_settings(uid_offset=offsets["uid"], read_ctr_offset=offsets["ctr"], mac_offset=offsets["cmac"]),
    )
    print("SDM 설정 완료.")
    print()
    print("이제 폰으로 태그를 태깅해 URL이 ?uid=..&ctr=..&cmac=.. 로 채워져 열리는지 확인할 것.")
    print("확인이 끝나면 --rotate-key를 붙여 다시 실행한다. 회전은 되돌릴 수 없다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

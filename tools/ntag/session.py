"""NTAG 424 DNA와의 인증 세션. transport만 갈아끼우면 어떤 리더에도 붙는다.

transport는 `transmit(apdu: bytes) -> (data: bytes, sw: str)` 하나만 제공하면 된다.
암호 연산은 crypto.py, 명령 상수는 apdu.py에 있다.
"""

import os

try:
    from tools.ntag.apdu import (
        ISO_READ_BINARY_INS,
        ISO_SELECT_NDEF_APP,
        ISO_SELECT_NDEF_FILE,
        ISO_UPDATE_BINARY_INS,
        MAX_SHORT_APDU_DATA,
        SW_ADDITIONAL_FRAME,
        SW_ISO_OK,
        SW_OK,
    )
    from tools.ntag.crypto import (
        build_change_key_data,
        command_iv,
        command_mac,
        decrypt_rnd_b,
        derive_auth_session_keys,
        encrypt_command_data,
        response_mac,
        rotate_left,
    )
except ModuleNotFoundError:
    from apdu import (
        ISO_READ_BINARY_INS,
        ISO_SELECT_NDEF_APP,
        ISO_SELECT_NDEF_FILE,
        ISO_UPDATE_BINARY_INS,
        MAX_SHORT_APDU_DATA,
        SW_ADDITIONAL_FRAME,
        SW_ISO_OK,
        SW_OK,
    )
    from crypto import (
        build_change_key_data,
        command_iv,
        command_mac,
        decrypt_rnd_b,
        derive_auth_session_keys,
        encrypt_command_data,
        response_mac,
        rotate_left,
    )

CMD_AUTH_EV2_FIRST = 0x71
CMD_ADDITIONAL_FRAME = 0xAF
CMD_GET_FILE_SETTINGS = 0xF5
CMD_CHANGE_FILE_SETTINGS = 0x5F
CMD_CHANGE_KEY = 0xC4


class AuthenticationError(Exception):
    pass


class CommandError(Exception):
    pass


def generate_random(length: int) -> bytes:
    """테스트가 이 함수만 바꿔치기해 인증 흐름을 재현할 수 있게 분리해 둔다."""
    return os.urandom(length)


class Ntag424Session:
    def __init__(self, transport):
        self.transport = transport
        self.ti: bytes | None = None
        self.ses_enc: bytes | None = None
        self.ses_mac: bytes | None = None
        self.cmd_ctr = 0

    # --- 저수준 ---

    def _transmit(self, apdu: bytes, *, expected: str) -> bytes:
        data, sw = self.transport.transmit(apdu)
        if sw != expected:
            raise CommandError(f"기대한 상태워드 {expected}가 아니라 {sw}가 왔다")
        return data

    @staticmethod
    def _wrap(cmd: int, payload: bytes) -> bytes:
        return bytes([0x90, cmd, 0x00, 0x00, len(payload)]) + payload + bytes([0x00])

    def _require_session(self) -> None:
        if self.ses_mac is None or self.ses_enc is None or self.ti is None:
            raise AuthenticationError("먼저 authenticate_ev2_first를 호출해야 한다")

    # --- 명령 ---

    def select_ndef_app(self) -> None:
        self._transmit(ISO_SELECT_NDEF_APP, expected=SW_ISO_OK)

    def select_ndef_file(self) -> None:
        """NDEF 파일을 EF로 선택한다. 애플리케이션 선택만으로는 EF가 잡히지 않는다.

        ISOUpdateBinary의 P1P2는 오프셋이라 대상 파일을 실을 자리가 없다.
        선택을 건너뛰면 쓰기가 6985(conditions of use not satisfied)로 거부된다.
        """
        self._transmit(ISO_SELECT_NDEF_FILE, expected=SW_ISO_OK)

    def authenticate_ev2_first(self, key_no: int, key: bytes) -> None:
        """AN12196 §6.6. 성공하면 세션키·TI가 서고 명령 카운터가 0으로 초기화된다."""
        encrypted_rnd_b = self._transmit(
            self._wrap(CMD_AUTH_EV2_FIRST, bytes([key_no, 0x00])), expected=SW_ADDITIONAL_FRAME
        )
        rnd_b = decrypt_rnd_b(key, encrypted_rnd_b)
        rnd_a = generate_random(16)

        challenge = encrypt_command_data(key, bytes(16), rnd_a + rotate_left(rnd_b), already_padded=True)
        response = self._transmit(self._wrap(CMD_ADDITIONAL_FRAME, challenge), expected=SW_OK)

        plain = decrypt_rnd_b(key, response)
        ti, rnd_a_echo = plain[0:4], plain[4:20]
        # 태그가 RndA를 한 바이트 왼쪽으로 돌려 돌려준다. 다르면 상대가 키를 모른다는 뜻이다.
        if rotate_left(rnd_a) != rnd_a_echo:
            raise AuthenticationError("태그가 돌려준 RndA가 맞지 않는다 — 키가 다르다")

        self.ti = ti
        self.ses_enc, self.ses_mac = derive_auth_session_keys(key, rnd_a, rnd_b)
        self.cmd_ctr = 0

    def _send_full(self, cmd: int, header: bytes, plain_data: bytes, *, already_padded: bool = False) -> bytes:
        """CommMode.FULL로 한 명령을 보낸다 — 데이터는 암호화하고 CMAC을 붙인다."""
        self._require_session()
        iv = command_iv(self.ses_enc, self.ti, self.cmd_ctr)
        encrypted = encrypt_command_data(self.ses_enc, iv, plain_data, already_padded=already_padded)
        mact = command_mac(self.ses_mac, cmd, self.cmd_ctr, self.ti, header, encrypted)

        data = self._transmit(self._wrap(cmd, header + encrypted + mact), expected=SW_OK)

        # 응답 CMAC까지 확인해야 중간자가 응답을 바꿔치기하는 경우를 잡는다.
        if data and data[-8:] != response_mac(self.ses_mac, self.cmd_ctr, self.ti, data[:-8]):
            raise CommandError("응답 CMAC이 맞지 않는다")
        self.cmd_ctr += 1
        return data

    def is_sdm_enabled(self, file_no: int) -> bool:
        """파일 설정을 읽어 SDM이 켜져 있는지 본다. 인증이 필요 없다(AN12196 §6.4).

        비가역인 키 회전을 걸기 전에, SDM 설정이 실제로 태그에 들어갔는지 확인하는 용도다.
        """
        data = self._transmit(self._wrap(CMD_GET_FILE_SETTINGS, bytes([file_no])), expected=SW_OK)
        # 응답은 FileType(1) || FileOption(1) || AccessRights(2) || FileSize(3) || ... 순이다.
        # 첫 바이트는 FileType이므로, 그걸 FileOption으로 읽으면 SDM이 켜진 태그를 꺼진 것으로 본다.
        if len(data) < 2:
            raise CommandError(f"파일 설정 응답이 너무 짧다: {data.hex().upper()}")
        return bool(data[1] & 0x40)

    def change_file_settings(self, file_no: int, cmd_data: bytes) -> None:
        self._send_full(CMD_CHANGE_FILE_SETTINGS, bytes([file_no]), cmd_data)

    def change_key(self, *, key_no: int, old_key: bytes, new_key: bytes, new_key_version: int) -> None:
        """되돌릴 수 없다. 여기서 잘못된 키를 쓰면 태그를 영구히 못 쓴다."""
        key_data = build_change_key_data(old_key=old_key, new_key=new_key, new_key_version=new_key_version)
        self._send_full(CMD_CHANGE_KEY, bytes([key_no]), key_data, already_padded=True)

    def update_binary(self, data: bytes, offset: int = 0) -> None:
        """NDEF 파일에 평문으로 쓴다(AN12196 §6.8.1, Cmd.ISOUpdateBinary).

        공장 상태의 NDEF 파일은 쓰기 권한이 free access라 보안 메시징으로 보내면 거부된다.
        인증도 필요 없다 — 파일 설정을 바꾸기 전에 이 방식으로 먼저 기록한다.
        """
        if len(data) > MAX_SHORT_APDU_DATA:
            raise ValueError(f"짧은 APDU에 담기지 않는다({len(data)}바이트). 나눠 써야 한다.")
        apdu = (
            bytes([0x00, ISO_UPDATE_BINARY_INS, (offset >> 8) & 0xFF, offset & 0xFF, len(data)]) + data + bytes([0x00])
        )
        self._transmit(apdu, expected=SW_ISO_OK)

    def read_binary(self, length: int, offset: int = 0) -> bytes:
        """선택된 EF를 평문으로 읽는다(ISOReadBinary).

        SDM이 켜진 뒤에 읽으면 태그가 UID·카운터·CMAC을 채워 넣은 상태로 돌려준다.
        키 회전 전에 CMAC 구성이 서버와 맞는지 확인할 수 있는 유일한 경로다 —
        회전 전에는 태그가 공장 키로 CMAC을 만들므로 서버 검증은 통과할 수 없다.
        """
        if not 0 < length <= MAX_SHORT_APDU_DATA:
            raise ValueError(f"짧은 APDU로 읽을 수 있는 길이가 아니다: {length}")
        apdu = bytes([0x00, ISO_READ_BINARY_INS, (offset >> 8) & 0xFF, offset & 0xFF, length])
        return self._transmit(apdu, expected=SW_ISO_OK)

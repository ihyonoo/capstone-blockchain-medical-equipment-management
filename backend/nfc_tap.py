"""NTAG 424 DNA 탭 검증 파이프라인과 탭 세션 관리.

탭 1회가 만드는 유효한 CMAC은 하나뿐인데 실제 흐름은 조회(GET)와 실행(POST)으로
요청이 두 번이다. 그래서 조회 단계에서 카운터를 소비하며 단발성 세션을 발급하고,
대여/반납은 그 세션을 요구한다. 순수 암호 함수는 backend/ntag424.py에 있다.
"""

import secrets

import psycopg
from fastapi import HTTPException

try:
    from backend.ntag424 import SdmParams, derive_sdm_session_mac_key, derive_tag_key, verify_cmac
    from backend.settings import DATABASE_URL, NTAG_MASTER_KEY
except ModuleNotFoundError:
    from ntag424 import SdmParams, derive_sdm_session_mac_key, derive_tag_key, verify_cmac
    from settings import DATABASE_URL, NTAG_MASTER_KEY

# 탭 세션 유효 시간. 환경변수로 빼지 않는다 — 3분은 요구사항이고, 설정으로 열어두면
# 배포마다 조용히 요구사항을 벗어날 수 있다.
TAP_SESSION_TTL_SEC = 180

# 만료된 세션을 언제 치울지. 별도 스케줄러 없이 탭이 일어날 때 같이 정리한다.
_SESSION_SWEEP_AGE = "1 hour"


def master_key_missing() -> bool:
    """마스터키가 없으면 실물 태그 경로는 열지 않는다(시뮬레이션 경로는 영향 없음)."""
    return NTAG_MASTER_KEY is None


class TapRejection(Exception):
    """장비를 특정할 수 있는 검증 실패. 감사 로그를 남기고 403으로 끝난다."""

    def __init__(self, reason: str, tag_id: str, action: str):
        super().__init__(reason)
        self.reason = reason
        self.tag_id = tag_id
        self.action = action


def _record_rejection(cur, rejection: TapRejection, ntag_uid: str, user_id: int | None):
    cur.execute(
        """
        INSERT INTO usage_nfc_events (tag_id, user_id, equipment_nfc_uid, action, result, reason, occurred_at)
        VALUES (%s, %s, %s, %s, 'rejected', %s, now())
        """,
        (rejection.tag_id, user_id, ntag_uid, rejection.action, rejection.reason),
    )


def verify_tap_and_mint_session(token: str, params: SdmParams, user: dict) -> tuple[str, str]:
    """탭을 검증하고 (tag_id, session_id)를 돌려준다.

    검증·카운터 소비·세션 발급이 한 트랜잭션이다. 중간에 실패하면 카운터도 전진하지 않는다.
    """
    if NTAG_MASTER_KEY is None:
        raise HTTPException(503, "NFC 태그 검증이 설정되지 않았습니다.")

    uid_hex = params.uid.hex().upper()

    with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT tag_id, nfc_tag_uid, asset_status
            FROM tags
            WHERE ntag_uid = %s AND ntag_bound = TRUE AND is_active = TRUE
            """,
            (uid_hex,),
        )
        row = cur.fetchone()
        # 미등록·미바인딩 UID는 장비를 특정할 수 없다. usage_nfc_events.tag_id가 NOT NULL이라
        # 감사 행을 남길 수도 없으므로, 아무것도 쓰지 않고 끝낸다.
        if row is None:
            raise HTTPException(404, "매핑되지 않은 NFC 태그입니다.")

        tag_id, stored_token, asset_status = row
        # 대여 중이면 이 탭은 반납 시도로 본다. 감사 로그의 action 값에만 쓴다.
        action = "return" if asset_status == "checked_out" else "checkout"

        try:
            # 쿼리스트링만 떼어 다른 장비 URL에 붙이는 시도를 여기서 잡는다.
            # CMAC은 경로 토큰을 덮지 않으므로 이 교차검증이 그 역할을 대신한다.
            if stored_token != token:
                raise TapRejection("uid_token_mismatch", tag_id, action)

            session_mac_key = derive_sdm_session_mac_key(
                derive_tag_key(NTAG_MASTER_KEY, params.uid), params.uid, params.read_ctr
            )
            if not verify_cmac(session_mac_key, b"", params.cmac):
                raise TapRejection("cmac_mismatch", tag_id, action)

            # 비교를 술어에 넣어야 한다. 파이썬에서 읽고 나중에 UPDATE하면 같은 URL을 든
            # 두 요청이 모두 통과해 세션이 두 개 발급된다.
            cur.execute(
                """
                UPDATE tags SET ntag_last_ctr = %s, updated_at = now()
                WHERE tag_id = %s AND ntag_last_ctr < %s
                RETURNING tag_id
                """,
                (params.read_ctr, tag_id, params.read_ctr),
            )
            if cur.fetchone() is None:
                raise TapRejection("counter_replay", tag_id, action)
        except TapRejection as rejection:
            _record_rejection(cur, rejection, uid_hex, user.get("user_id"))
            conn.commit()
            # 401이 아니라 403이다. 401은 "누구인지 모르겠다"는 뜻이라 클라이언트가
            # 로그인 만료로 해석해 세션을 버린다. 여기서는 사용자가 누구인지 알고 있고
            # 이 탭만 무효다 — 3분 지난 탭 때문에 멀쩡한 로그인이 날아가면 안 된다.
            raise HTTPException(403, "유효하지 않은 NFC 태그 인증입니다.")

        session_id = secrets.token_urlsafe(32)
        cur.execute(
            """
            INSERT INTO nfc_tap_sessions (session_id, tag_id, user_id, read_ctr, expires_at)
            VALUES (%s, %s, %s, %s, now() + make_interval(secs => %s))
            """,
            (session_id, tag_id, user["user_id"], params.read_ctr, TAP_SESSION_TTL_SEC),
        )
        cur.execute(
            f"DELETE FROM nfc_tap_sessions WHERE expires_at < now() - interval '{_SESSION_SWEEP_AGE}'"  # noqa: S608
        )
        conn.commit()

    return tag_id, session_id


def consume_tap_session(cur, session_id: str | None, tag_id: str, user_id: int) -> bool:
    """탭 세션을 소비한다. 호출자의 트랜잭션 안에서 돈다 — 액션이 실패하면 함께 롤백된다.

    조건을 전부 UPDATE 술어에 넣어, 같은 세션을 든 두 요청 중 정확히 하나만 성공한다.
    """
    if not session_id:
        return False
    cur.execute(
        """
        UPDATE nfc_tap_sessions SET consumed_at = now()
        WHERE session_id = %s AND tag_id = %s AND user_id = %s
          AND consumed_at IS NULL AND expires_at > now()
        RETURNING session_id
        """,
        (session_id, tag_id, user_id),
    )
    return cur.fetchone() is not None

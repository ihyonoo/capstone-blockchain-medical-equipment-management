import os
import time
import json
import hashlib
from typing import Dict, List

import psycopg
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from pydantic import BaseModel

app = FastAPI()     # FastAPI 애플리케이션 인스턴스 생성

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:9124@localhost:5432/rtls",
)
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_allowed_origins() -> List[str]:
    raw = os.getenv("CORS_ALLOW_ORIGINS")
    if raw:
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return ["http://localhost:5173", "http://127.0.0.1:5173"]


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# reader_id -> location string
# 출력해주기 위하여 Reader_ID를 정확한 구역의 이름으로 mapping
READER_LOCATION = {
    "M501": "M501호",
    "M502": "M502호",
}

# 서버 메모리 상태 저장소
tag_obs: Dict[str, Dict[str, dict]] = {}    # 태그별로, 리더별 관측값을 저장하는 딕셔너리 / tag_id -> reader_id -> observation
tag_state: Dict[str, dict] = {}             # 태그별로 위치 결정 상태를 저장하는 딕셔너리 / tag_id -> 결정된 현재 위치 상태

# 튐 방지 파라미터
HYST_DB = 8          # dB 이상 차이날 때만 변경
DWELL_SEC = 2        # 2초 연속이면 변경 확정
STALE_SEC = 5        # 5초 이상 안 들어온 reader 데이터는 무시

############# 요청 스키마 정리 ###########
class Observation(BaseModel):
    tag_id: str
    rssi: int
    count: int
    last_seen: int

class Payload(BaseModel):
    reader_id: str
    ts: int
    observations: List[Observation]
#######################################3


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    display_name: str
    password: str
    position: str
    nfc_uid: str | None = None
    role: str = "staff"
    department: str | None = None
    is_active: bool = True


class NfcLoginRequest(BaseModel):
    nfc_uid: str


class UsageStartRequest(BaseModel):
    nfc_uid: str
    tag_id: str
    checkout_reader_id: str | None = None
    checkout_location: str | None = None
    checkout_at_epoch: int | None = None


class UsageReturnRequest(BaseModel):
    usage_id: int
    return_reader_id: str | None = None
    return_location: str | None = None
    returned_at_epoch: int | None = None


def upsert_tags_from_observations(tag_ids: set[str]) -> None:
    if not tag_ids:
        return

    # RTLS 수신 태그를 DB 마스터에 자동 등록한다.
    # 이미 등록된 태그의 장비명은 유지하고, NULL 인 경우에만 "제세동기"를 채운다.
    sql = """
    INSERT INTO tags (tag_id, equipment_name, is_active, created_at)
    VALUES (%s, %s, TRUE, now())
    ON CONFLICT (tag_id) DO UPDATE
    SET
      equipment_name = COALESCE(tags.equipment_name, EXCLUDED.equipment_name),
      is_active = TRUE
    """
    try:
        rows = [(tag_id, "제세동기") for tag_id in tag_ids]
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            cur.executemany(sql, rows)
    except Exception:
        # DB 반영 실패 시에도 실시간 위치 판별은 계속 동작해야 한다.
        pass


def upsert_readers_from_ingest(reader_ids: set[str]) -> None:
    if not reader_ids:
        return

    sql = """
    INSERT INTO readers (reader_id, location_name, is_active, created_at)
    VALUES (%s, %s, TRUE, now())
    ON CONFLICT (reader_id) DO UPDATE
    SET
      location_name = COALESCE(readers.location_name, EXCLUDED.location_name),
      is_active = TRUE
    """
    try:
        rows = [(reader_id, READER_LOCATION.get(reader_id, reader_id)) for reader_id in reader_ids]
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            cur.executemany(sql, rows)
    except Exception:
        # 리더 마스터 반영 실패 시에도 실시간 위치 판별은 계속 동작해야 한다.
        pass


def upsert_current_locations(updates: Dict[str, tuple[str, int | None, int]]) -> None:
    if not updates:
        return

    sql = """
    INSERT INTO tag_state_current (tag_id, reader_id, last_rssi, updated_at)
    VALUES (%s, %s, %s, to_timestamp(%s))
    ON CONFLICT (tag_id) DO UPDATE
    SET
      reader_id = EXCLUDED.reader_id,
      last_rssi = EXCLUDED.last_rssi,
      updated_at = EXCLUDED.updated_at
    WHERE tag_state_current.reader_id IS DISTINCT FROM EXCLUDED.reader_id
    """
    try:
        rows = [
            (tag_id, reader_id, last_rssi, changed_at_epoch)
            for tag_id, (reader_id, last_rssi, changed_at_epoch) in updates.items()
        ]
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            cur.executemany(sql, rows)
    except Exception:
        # DB 반영 실패 시에도 위치 연산은 유지한다.
        pass


def normalize_nfc_uid(value: str | None) -> str | None:
    # NFC UID는 공백/대소문자 차이로 중복이 생기지 않도록 정규화한다.
    if value is None:
        return None
    normalized = value.strip().upper()
    return normalized or None


def resolve_location_name(reader_id: str | None, fallback: str | None = None) -> str | None:
    # 위치명을 요청 본문에서 우선 받고, 없으면 reader 마스터에서 조회한다.
    if fallback and fallback.strip():
        return fallback.strip()
    if not reader_id:
        return None

    sql = """
    SELECT COALESCE(location_name, reader_id)
    FROM readers
    WHERE reader_id = %s
    """
    try:
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            cur.execute(sql, (reader_id,))
            row = cur.fetchone()
            if row:
                return row[0]
    except Exception:
        # 위치 조회 실패 시에도 서비스 흐름을 막지 않기 위해 reader_id를 반환한다.
        pass
    return reader_id


def usage_hash_payload_from_row(row: tuple) -> dict:
    # usage_history의 핵심 비즈니스 컬럼만 정렬된 JSON으로 고정해 해시 안정성을 확보한다.
    return {
        "usage_id": row[0],
        "user_id": row[1],
        "user_name_snapshot": row[2],
        "user_position_snapshot": row[3],
        "user_department_snapshot": row[4],
        "tag_id": row[5],
        "equipment_name_snapshot": row[6],
        "checkout_reader_id": row[7],
        "checkout_location_snapshot": row[8],
        "checkout_at": row[9].isoformat() if row[9] else None,
        "return_reader_id": row[10],
        "return_location_snapshot": row[11],
        "returned_at": row[12].isoformat() if row[12] else None,
    }


def calculate_usage_hash(payload: dict) -> str:
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


@app.post("/auth/register")
def register(body: RegisterRequest):
    username = body.username.strip()
    display_name = body.display_name.strip()
    position = body.position.strip()
    role = body.role.strip().lower()
    password = body.password
    nfc_uid = normalize_nfc_uid(body.nfc_uid)

    if not username or not display_name or not password or not position:
        raise HTTPException(400, "username, display_name, password, position은 필수입니다.")

    if role not in ("admin", "staff"):
        raise HTTPException(400, "role은 admin 또는 staff여야 합니다.")

    if len(password) < 8:
        raise HTTPException(400, "비밀번호는 8자 이상이어야 합니다.")

    password_hash = pwd.hash(password)

    sql = """
    INSERT INTO users (username, display_name, role, department, position, nfc_uid, password_hash, is_active, created_at)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, now())
    RETURNING user_id, username, display_name, role, department, position, nfc_uid, is_active
    """
    try:
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            cur.execute(
                sql,
                (
                    username,
                    display_name,
                    role,
                    body.department,
                    position,
                    nfc_uid,
                    password_hash,
                    body.is_active,
                ),
            )
            row = cur.fetchone()
    except psycopg.errors.UniqueViolation:
        raise HTTPException(409, "이미 존재하는 username 또는 nfc_uid입니다.")
    except Exception:
        raise HTTPException(500, "회원가입 처리 중 데이터베이스 오류가 발생했습니다.")

    return {
        "ok": True,
        "user": {
            "user_id": row[0],
            "username": row[1],
            "display_name": row[2],
            "role": row[3],
            "department": row[4],
            "position": row[5],
            "nfc_uid": row[6],
            "is_active": row[7],
        },
    }


@app.post("/auth/login")
def login(body: LoginRequest):
    username = body.username.strip()
    if not username or not body.password:
        raise HTTPException(400, "username과 password는 필수입니다.")

    sql = """
    SELECT user_id, username, display_name, role, department, position, nfc_uid, password_hash, is_active
    FROM users
    WHERE username = %s
    """
    try:
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            cur.execute(sql, (username,))
            row = cur.fetchone()
    except Exception:
        raise HTTPException(500, "로그인 처리 중 데이터베이스 오류가 발생했습니다.")

    if not row:
        raise HTTPException(401, "아이디 또는 비밀번호가 올바르지 않습니다.")

    user_id, db_username, display_name, role, department, position, nfc_uid, password_hash, is_active = row

    if not is_active:
        raise HTTPException(403, "비활성화된 계정입니다.")

    if not pwd.verify(body.password, password_hash):
        raise HTTPException(401, "아이디 또는 비밀번호가 올바르지 않습니다.")

    return {
        "ok": True,
        "user": {
            "user_id": user_id,
            "username": db_username,
            "display_name": display_name,
            "role": role,
            "department": department,
            "position": position,
            "nfc_uid": nfc_uid,
        },
    }


@app.post("/auth/nfc-login")
def nfc_login(body: NfcLoginRequest):
    nfc_uid = normalize_nfc_uid(body.nfc_uid)
    if not nfc_uid:
        raise HTTPException(400, "nfc_uid는 필수입니다.")

    # NFC UID로 사용자 식별한다.
    sql = """
    SELECT user_id, username, display_name, role, department, position, nfc_uid, is_active
    FROM users
    WHERE nfc_uid = %s
    """
    try:
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            cur.execute(sql, (nfc_uid,))
            row = cur.fetchone()
    except Exception:
        raise HTTPException(500, "NFC 로그인 처리 중 데이터베이스 오류가 발생했습니다.")

    if not row:
        raise HTTPException(404, "등록되지 않은 NFC UID입니다.")

    user_id, username, display_name, role, department, position, db_nfc_uid, is_active = row
    if not is_active:
        raise HTTPException(403, "비활성화된 계정입니다.")

    return {
        "ok": True,
        "user": {
            "user_id": user_id,
            "username": username,
            "display_name": display_name,
            "role": role,
            "department": department,
            "position": position,
            "nfc_uid": db_nfc_uid,
        },
    }

# 특정 태그에 대해, 현재 시각 가장 강한 RSSI를 가진 리더를 탐색
def pick_best_reader(tag_id: str, now: int):
    readers = tag_obs.get(tag_id, {})   # 해당 태그의 리더별 관측 딕셔너리

    candidates = []                     # 유효한 후보들만 모을 리스트

    for rid, ob in readers.items():
        if now - ob["recv_ts"] <= STALE_SEC:  # 관측이 너무 오래되지는 않았는지 검증
            candidates.append((rid, ob["rssi"], ob["recv_ts"]))   # 튜플로 리스트에 추가
   
    # 유효한 후보가 없으면 결정 불가능
    if not candidates:
        return None
    
    # RSSI가 큰 순으로 정렬
    candidates.sort(key=lambda x: x[1], reverse=True)

    # 가장 강한 리더기를 반환
    return candidates[0]  # 반환 형태: 튜플(reader_id, rssi, last_seen)

# 수집 엔드포인트
@app.post("/ingest")        # POST /ingest 라우트
def ingest(payload: Payload):
    now = int(time.time())      # 현재 시간
    rid = payload.reader_id     # reader_id 추출
    upsert_tags_from_observations({ob.tag_id for ob in payload.observations})
    upsert_readers_from_ingest({rid})
    db_updates: Dict[str, tuple[str, int | None, int]] = {}

    last_tag_id = None
    last_best = None

    for ob in payload.observations:
        tag_id = ob.tag_id
        last_tag_id = tag_id

        tag_obs.setdefault(tag_id, {})
        tag_obs[tag_id][rid] = {
            "rssi": ob.rssi,
            "count": ob.count,
            "last_seen": ob.last_seen,  # 기록용
            "recv_ts": now,             # 서버 수신 시각
        }

        best = pick_best_reader(tag_id, now)
        last_best = best

        if best is None:
            continue

        best_rid, best_rssi, _ = best

        state = tag_state.setdefault(tag_id, {
            "current_reader": None,
            "current_rssi": None,
            "candidate_reader": None,
            "candidate_since": None,
            "updated_at": None,
        })

        cur = state["current_reader"]

        # 최초 결정
        if cur is None:
            state["current_reader"] = best_rid
            state["current_rssi"] = best_rssi
            state["updated_at"] = now
            state["candidate_reader"] = None
            state["candidate_since"] = None
            db_updates[tag_id] = (best_rid, best_rssi, now)
            continue

        # 현재 리더 RSSI 가져오기(없으면 매우 약하다고 간주)
        cur_ob = tag_obs[tag_id].get(cur)
        cur_rssi = cur_ob["rssi"] if cur_ob and (now - cur_ob["recv_ts"] <= STALE_SEC) else -999

        # 후보가 현재와 같으면 후보 초기화 + 현재 업데이트
        if best_rid == cur:
            state["current_rssi"] = best_rssi
            state["candidate_reader"] = None
            state["candidate_since"] = None
            state["updated_at"] = now
            continue

        # 히스테리시스: 후보가 현재보다 충분히 강해야 변경
        if best_rssi - cur_rssi < HYST_DB:
            state["candidate_reader"] = None
            state["candidate_since"] = None
            state["current_rssi"] = cur_rssi
            state["updated_at"] = now
            continue

        # 지속시간: 후보가 일정 시간 유지돼야 변경
        if state["candidate_reader"] != best_rid:
            state["candidate_reader"] = best_rid
            state["candidate_since"] = now
        else:
            if state["candidate_since"] and (now - state["candidate_since"] >= DWELL_SEC):
                state["current_reader"] = best_rid
                state["current_rssi"] = best_rssi
                state["updated_at"] = now
                state["candidate_reader"] = None
                state["candidate_since"] = None
                db_updates[tag_id] = (best_rid, best_rssi, now)

    upsert_current_locations(db_updates)

    # 디버그 출력
    if last_tag_id is not None:
        print(f"[tag ID]\n{last_tag_id}")
        print("\n[readers]")

        readers = tag_obs.get(last_tag_id, {})
        for rid, ob in readers.items():
            print(
                f"{rid}: "
                f"rssi = {ob['rssi']} "
                #f"count={ob['count']}, "
                #f"last_seen={ob['last_seen']}"
            )

        print("\n[best]\n", last_best[0],": ", last_best[1])

    return {"ok": True}


# 결과
@app.get("/where/{tag_id}")
def where(tag_id: str):
    sql = """
    SELECT
      c.reader_id,
      COALESCE(r.location_name, c.reader_id) AS location,
      c.last_rssi,
      EXTRACT(EPOCH FROM c.updated_at)::BIGINT AS updated_at_epoch
    FROM tag_state_current c
    LEFT JOIN readers r ON r.reader_id = c.reader_id
    WHERE c.tag_id = %s
    """
    try:
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            cur.execute(sql, (tag_id,))
            row = cur.fetchone()
    except Exception:
        raise HTTPException(500, "현재 위치 조회 중 데이터베이스 오류가 발생했습니다.")

    if not row:
        return {"ok": False, "reason": "unknown"}

    rid, location, last_rssi, updated_at_epoch = row
    is_stale = False
    if isinstance(updated_at_epoch, int):
        is_stale = (int(time.time()) - updated_at_epoch) > (STALE_SEC * 2)

    return {
        "ok": True,
        "tag_id": tag_id,
        "reader_id": rid,
        "location": location,
        "rssi": last_rssi,
        "updated_at": updated_at_epoch,
        "is_stale": is_stale,
    }


@app.get("/rtls/live")
def rtls_live():
    now = int(time.time())
    sql = """
    SELECT
      c.tag_id,
      t.equipment_name,
      t.equipment_type,
      t.serial_number,
      c.reader_id,
      COALESCE(r.location_name, c.reader_id) AS location,
      c.last_rssi,
      EXTRACT(EPOCH FROM c.updated_at)::BIGINT AS updated_at_epoch
    FROM tag_state_current c
    LEFT JOIN tags t ON t.tag_id = c.tag_id
    LEFT JOIN readers r ON r.reader_id = c.reader_id
    ORDER BY c.updated_at DESC
    """
    readers_sql = """
    SELECT reader_id, COALESCE(location_name, reader_id) AS location
    FROM readers
    WHERE is_active = TRUE
    ORDER BY reader_id
    """
    try:
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()
            cur.execute(readers_sql)
            reader_rows = cur.fetchall()
    except Exception:
        raise HTTPException(500, "실시간 위치 조회 중 데이터베이스 오류가 발생했습니다.")

    items = []
    for (
        tag_id,
        equipment_name,
        equipment_type,
        serial_number,
        reader_id,
        location,
        last_rssi,
        updated_at_epoch,
    ) in rows:
        is_stale = False
        if isinstance(updated_at_epoch, int):
            is_stale = (now - updated_at_epoch) > (STALE_SEC * 2)
        items.append(
            {
                "tag_id": tag_id,
                "equipment_name": equipment_name,
                "equipment_type": equipment_type,
                "serial_number": serial_number,
                "reader_id": reader_id,
                "location": location,
                "rssi": last_rssi,
                "updated_at": updated_at_epoch,
                "is_stale": is_stale,
            }
        )

    readers = [
        {"reader_id": reader_id, "location": location}
        for (reader_id, location) in reader_rows
    ]
    if not readers:
        readers = [
            {"reader_id": reader_id, "location": location}
            for reader_id, location in READER_LOCATION.items()
        ]

    return {
        "ok": True,
        "count": len(items),
        "ts": now,
        "items": items,
        "readers": readers,
    }


def fetch_user_by_nfc_uid(cur, nfc_uid: str):
    sql = """
    SELECT user_id, display_name, position, department, is_active
    FROM users
    WHERE nfc_uid = %s
    """
    cur.execute(sql, (nfc_uid,))
    return cur.fetchone()


def fetch_tag_snapshot(cur, tag_id: str):
    sql = """
    SELECT tag_id, COALESCE(equipment_name, tag_id) AS equipment_name
    FROM tags
    WHERE tag_id = %s
    """
    cur.execute(sql, (tag_id,))
    return cur.fetchone()


@app.post("/usage/start")
def usage_start(body: UsageStartRequest):
    nfc_uid = normalize_nfc_uid(body.nfc_uid)
    tag_id = body.tag_id.strip()
    checkout_reader_id = body.checkout_reader_id.strip() if body.checkout_reader_id else None
    checkout_at_epoch = body.checkout_at_epoch or int(time.time())

    if not nfc_uid:
        raise HTTPException(400, "nfc_uid는 필수입니다.")
    if not tag_id:
        raise HTTPException(400, "tag_id는 필수입니다.")

    # reader FK 실패 방지를 위해 미등록 리더는 자동 등록한다.
    if checkout_reader_id:
        upsert_readers_from_ingest({checkout_reader_id})
    checkout_location = resolve_location_name(checkout_reader_id, body.checkout_location)

    # 대여 시작 시점의 사용자/장비 정보를 스냅샷으로 고정 저장한다.
    insert_sql = """
    INSERT INTO usage_history (
      user_id,
      user_name_snapshot,
      user_position_snapshot,
      user_department_snapshot,
      tag_id,
      equipment_name_snapshot,
      checkout_reader_id,
      checkout_location_snapshot,
      checkout_at
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, to_timestamp(%s))
    RETURNING usage_id, checkout_at
    """
    try:
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            user_row = fetch_user_by_nfc_uid(cur, nfc_uid)
            if not user_row:
                raise HTTPException(404, "등록되지 않은 NFC UID입니다.")
            user_id, display_name, position, department, is_active = user_row
            if not is_active:
                raise HTTPException(403, "비활성화된 계정입니다.")

            tag_row = fetch_tag_snapshot(cur, tag_id)
            if not tag_row:
                raise HTTPException(404, "등록되지 않은 tag_id입니다.")
            _, equipment_name = tag_row

            cur.execute(
                insert_sql,
                (
                    user_id,
                    display_name,
                    position,
                    department,
                    tag_id,
                    equipment_name,
                    checkout_reader_id,
                    checkout_location,
                    checkout_at_epoch,
                ),
            )
            usage_id, checkout_at = cur.fetchone()
    except HTTPException:
        raise
    except psycopg.errors.ForeignKeyViolation:
        raise HTTPException(400, "user_id/tag_id/reader_id 참조 무결성 오류가 발생했습니다.")
    except Exception:
        raise HTTPException(500, "사용 시작 이력 저장 중 데이터베이스 오류가 발생했습니다.")

    return {
        "ok": True,
        "usage": {
            "usage_id": usage_id,
            "nfc_uid": nfc_uid,
            "tag_id": tag_id,
            "checkout_reader_id": checkout_reader_id,
            "checkout_location": checkout_location,
            "checkout_at": int(checkout_at.timestamp()),
        },
    }


@app.post("/usage/return")
def usage_return(body: UsageReturnRequest):
    usage_id = body.usage_id
    return_reader_id = body.return_reader_id.strip() if body.return_reader_id else None
    returned_at_epoch = body.returned_at_epoch or int(time.time())

    if usage_id <= 0:
        raise HTTPException(400, "usage_id는 1 이상의 값이어야 합니다.")

    if return_reader_id:
        upsert_readers_from_ingest({return_reader_id})
    return_location = resolve_location_name(return_reader_id, body.return_location)

    # 반납 완료 시점의 확정 레코드로 해시를 만들고 usage_integrity에 저장한다.
    lock_sql = """
    SELECT usage_id, returned_at
    FROM usage_history
    WHERE usage_id = %s
    FOR UPDATE
    """
    update_sql = """
    UPDATE usage_history
    SET
      return_reader_id = %s,
      return_location_snapshot = %s,
      returned_at = to_timestamp(%s)
    WHERE usage_id = %s
    RETURNING usage_id, returned_at
    """
    read_for_hash_sql = """
    SELECT
      usage_id,
      user_id,
      user_name_snapshot,
      user_position_snapshot,
      user_department_snapshot,
      tag_id,
      equipment_name_snapshot,
      checkout_reader_id,
      checkout_location_snapshot,
      checkout_at,
      return_reader_id,
      return_location_snapshot,
      returned_at
    FROM usage_history
    WHERE usage_id = %s
    """
    upsert_integrity_sql = """
    INSERT INTO usage_integrity (usage_id, record_hash, anchored_at)
    VALUES (%s, %s, now())
    ON CONFLICT (usage_id) DO UPDATE
    SET record_hash = EXCLUDED.record_hash,
        anchored_at = EXCLUDED.anchored_at
    """

    try:
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            cur.execute(lock_sql, (usage_id,))
            lock_row = cur.fetchone()
            if not lock_row:
                raise HTTPException(404, "usage_id를 찾을 수 없습니다.")
            if lock_row[1] is not None:
                raise HTTPException(409, "이미 반납 완료된 이력입니다.")

            cur.execute(update_sql, (return_reader_id, return_location, returned_at_epoch, usage_id))
            updated = cur.fetchone()
            if not updated:
                raise HTTPException(404, "usage_id를 찾을 수 없습니다.")

            cur.execute(read_for_hash_sql, (usage_id,))
            row_for_hash = cur.fetchone()
            if not row_for_hash:
                raise HTTPException(500, "해시 생성을 위한 이력 조회에 실패했습니다.")

            hash_payload = usage_hash_payload_from_row(row_for_hash)
            record_hash = calculate_usage_hash(hash_payload)
            cur.execute(upsert_integrity_sql, (usage_id, record_hash))

            returned_at = updated[1]
    except HTTPException:
        raise
    except psycopg.errors.CheckViolation:
        raise HTTPException(400, "returned_at은 checkout_at보다 빠를 수 없습니다.")
    except psycopg.errors.ForeignKeyViolation:
        raise HTTPException(400, "return_reader_id 참조 무결성 오류가 발생했습니다.")
    except Exception:
        raise HTTPException(500, "반납 처리 중 데이터베이스 오류가 발생했습니다.")

    return {
        "ok": True,
        "usage_id": usage_id,
        "returned_at": int(returned_at.timestamp()) if returned_at else returned_at_epoch,
        "record_hash": record_hash,
    }


@app.get("/usage/history")
def usage_history(limit: int = 100, include_open: bool = True):
    # 목록 응답의 최대 건수를 제한해 과도한 풀스캔을 막는다.
    safe_limit = max(1, min(limit, 500))
    sql = """
    SELECT
      h.usage_id,
      h.user_id,
      h.user_name_snapshot,
      h.user_position_snapshot,
      h.user_department_snapshot,
      h.tag_id,
      h.equipment_name_snapshot,
      h.checkout_reader_id,
      h.checkout_location_snapshot,
      EXTRACT(EPOCH FROM h.checkout_at)::BIGINT AS checkout_at_epoch,
      h.return_reader_id,
      h.return_location_snapshot,
      EXTRACT(EPOCH FROM h.returned_at)::BIGINT AS returned_at_epoch,
      i.record_hash,
      EXTRACT(EPOCH FROM i.anchored_at)::BIGINT AS anchored_at_epoch
    FROM usage_history h
    LEFT JOIN usage_integrity i ON i.usage_id = h.usage_id
    WHERE (%s OR h.returned_at IS NOT NULL)
    ORDER BY h.checkout_at DESC
    LIMIT %s
    """
    try:
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            cur.execute(sql, (include_open, safe_limit))
            rows = cur.fetchall()
    except Exception:
        raise HTTPException(500, "사용 이력 조회 중 데이터베이스 오류가 발생했습니다.")

    items = []
    for row in rows:
        items.append(
            {
                "usage_id": row[0],
                "user": {
                    "user_id": row[1],
                    "name": row[2],
                    "position": row[3],
                    "department": row[4],
                },
                "equipment": {
                    "tag_id": row[5],
                    "name": row[6],
                },
                "checkout": {
                    "reader_id": row[7],
                    "location": row[8],
                    "at": row[9],
                },
                "return": {
                    "reader_id": row[10],
                    "location": row[11],
                    "at": row[12],
                },
                "integrity": {
                    "record_hash": row[13],
                    "anchored_at": row[14],
                },
            }
        )
    return {"ok": True, "count": len(items), "items": items}


@app.get("/integrity/verify/{usage_id}")
def verify_usage_integrity(usage_id: int):
    if usage_id <= 0:
        raise HTTPException(400, "usage_id는 1 이상의 값이어야 합니다.")

    sql = """
    SELECT
      h.usage_id,
      h.user_id,
      h.user_name_snapshot,
      h.user_position_snapshot,
      h.user_department_snapshot,
      h.tag_id,
      h.equipment_name_snapshot,
      h.checkout_reader_id,
      h.checkout_location_snapshot,
      h.checkout_at,
      h.return_reader_id,
      h.return_location_snapshot,
      h.returned_at,
      i.record_hash
    FROM usage_history h
    LEFT JOIN usage_integrity i ON i.usage_id = h.usage_id
    WHERE h.usage_id = %s
    """
    try:
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            cur.execute(sql, (usage_id,))
            row = cur.fetchone()
    except Exception:
        raise HTTPException(500, "무결성 검증 조회 중 데이터베이스 오류가 발생했습니다.")

    if not row:
        raise HTTPException(404, "usage_id를 찾을 수 없습니다.")

    if not row[13]:
        raise HTTPException(409, "아직 반납 완료(해시 앵커링)되지 않은 이력입니다.")

    payload = usage_hash_payload_from_row(row[:13])
    calculated_hash = calculate_usage_hash(payload)

    # 현재 단계에서는 DB에 저장된 앵커 해시를 온체인 조회 결과로 간주한다.
    # 실제 Besu 연동 시 이 값을 RPC 조회값으로 교체하면 된다.
    blockchain_hash = row[13]
    verified = calculated_hash == blockchain_hash

    return {
        "ok": True,
        "usage_id": usage_id,
        "calculated_hash": calculated_hash,
        "blockchain_hash": blockchain_hash,
        "verified": verified,
    }

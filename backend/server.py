import os
import time
import csv
import io
import json
import hashlib
import datetime as dt
import subprocess
from pathlib import Path
from typing import Dict, List

import psycopg
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from pydantic import BaseModel
from dotenv import load_dotenv

# 백엔드는 저장소 루트의 .env를 기준으로 읽는다.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

app = FastAPI()     # FastAPI 애플리케이션 인스턴스 생성

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:9124@localhost:5432/rtls",
)
BESU_DIR = Path(__file__).resolve().parents[1] / "blockchain" / "besu"
BESU_DEPLOYMENT_PATH = BESU_DIR / "deployments" / "usage-registry.json"
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_allowed_origins() -> List[str]:
    raw = os.getenv("CORS_ALLOW_ORIGINS")
    if raw:
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return ["http://localhost:5173", "http://127.0.0.1:5173"]


def get_allowed_origin_regex() -> str:
    # Allow common private-network dev origins so phones and Raspberry Pis on the
    # same LAN can reach the backend during local development.
    return (
        r"^https?://("
        r"localhost|"
        r"127\.0\.0\.1|"
        r"192\.168\.\d+\.\d+|"
        r"10\.\d+\.\d+\.\d+|"
        r"172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+"
        r")(:\d+)?$"
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_origin_regex=get_allowed_origin_regex(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# reader_id -> location string
# 출력해주기 위하여 Reader_ID를 정확한 구역의 이름으로 mapping
READER_LOCATION = {
    "ER-TRIAGE": "응급실",
    "ICU-WARD": "중환자실",
    "M503": "수술실",
    "M504": "영상의학과",
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
    role: str


class RegisterRequest(BaseModel):
    username: str
    display_name: str
    password: str
    position: str | None = None
    role: str = "staff"
    department: str | None = None
    is_active: bool = True


class NfcMappingUpsertRequest(BaseModel):
    tag_id: str
    nfc_token: str
    actor_role: str | None = None


class NfcUsageActionRequest(BaseModel):
    nfc_token: str
    user_id: int
    username: str
    display_name: str
    role: str
    department: str | None = None
    position: str | None = None


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


def insert_location_history(updates: Dict[str, tuple[str, int | None, int]]) -> None:
    if not updates:
        return

    # 현재 위치 스냅샷 테이블을 사용하지 않고, 위치 변화 이력만 누적 저장한다.
    sql = """
    INSERT INTO tag_state_history (tag_id, reader_id, rssi, decided_at)
    VALUES (%s, %s, %s, to_timestamp(%s))
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


def load_reader_location_map() -> dict[str, str]:
    sql = """
    SELECT reader_id, COALESCE(location_name, reader_id) AS location
    FROM readers
    ORDER BY reader_id
    """
    try:
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()
    except Exception:
        return dict(READER_LOCATION)

    mapping = {reader_id: location for (reader_id, location) in rows}
    if not mapping:
        return dict(READER_LOCATION)
    return mapping


def load_tag_metadata(tag_ids: set[str]) -> dict[str, dict]:
    if not tag_ids:
        return {}

    sql = """
    SELECT
      t.tag_id,
      t.equipment_name,
      t.equipment_type,
      t.serial_number,
      t.asset_status,
      t.current_holder_user_id,
      COALESCE(u.display_name, u.username) AS current_holder_name
    FROM tags t
    LEFT JOIN users u ON u.user_id = t.current_holder_user_id
    WHERE tag_id = ANY(%s)
    """
    try:
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            cur.execute(sql, (list(tag_ids),))
            rows = cur.fetchall()
    except Exception:
        return {}

    return {
        row[0]: {
            "equipment_name": row[1],
            "equipment_type": row[2],
            "serial_number": row[3],
            "asset_status": row[4],
            "current_holder_user_id": row[5],
            "current_holder_name": row[6],
        }
        for row in rows
    }


def normalize_nfc_token(raw: str) -> str:
    token = raw.strip()
    if not token:
        raise HTTPException(400, "nfc_token은 비어 있을 수 없습니다.")
    if any(ch.isspace() for ch in token) or "/" in token or "?" in token or "#" in token:
        raise HTTPException(400, "nfc_token에는 공백, '/', '?', '#' 문자를 사용할 수 없습니다.")
    return token


def require_admin_actor(role: str | None) -> None:
    if (role or "").strip().lower() != "admin":
        raise HTTPException(403, "관리자 권한이 필요합니다.")


def validate_usage_actor(body: NfcUsageActionRequest) -> dict:
    username = body.username.strip()
    display_name = body.display_name.strip()
    role = body.role.strip().lower()

    if not username or not display_name:
        raise HTTPException(400, "username과 display_name은 필수입니다.")
    if role not in ("admin", "staff"):
        raise HTTPException(400, "role은 admin 또는 staff여야 합니다.")

    return {
        "user_id": body.user_id,
        "username": username,
        "display_name": display_name,
        "role": role,
        "department": body.department.strip() if body.department else None,
        "position": body.position.strip() if body.position else None,
    }


def resolve_tag_location_snapshot(tag_id: str, now: int | None = None, reader_locations: dict[str, str] | None = None):
    current_ts = now if now is not None else int(time.time())
    locations = reader_locations if reader_locations is not None else load_reader_location_map()

    state = tag_state.get(tag_id)
    if state and state.get("current_reader"):
        rid = state["current_reader"]
        updated_at_epoch = state.get("updated_at")
        last_rssi = state.get("current_rssi")
        is_stale = False
        if isinstance(updated_at_epoch, int):
            is_stale = (current_ts - updated_at_epoch) > (STALE_SEC * 2)

        return {
            "reader_id": rid,
            "location": locations.get(rid, READER_LOCATION.get(rid, rid)),
            "rssi": last_rssi,
            "updated_at": updated_at_epoch,
            "is_stale": is_stale,
        }

    sql = """
    SELECT
      h.reader_id,
      COALESCE(r.location_name, h.reader_id) AS location,
      h.rssi,
      EXTRACT(EPOCH FROM h.decided_at)::BIGINT AS updated_at_epoch
    FROM tag_state_history h
    LEFT JOIN readers r ON r.reader_id = h.reader_id
    WHERE h.tag_id = %s
    ORDER BY h.decided_at DESC
    LIMIT 1
    """
    try:
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            cur.execute(sql, (tag_id,))
            row = cur.fetchone()
    except Exception:
        raise HTTPException(500, "현재 위치 조회 중 데이터베이스 오류가 발생했습니다.")

    if not row:
        return None

    rid, location, last_rssi, updated_at_epoch = row
    is_stale = False
    if isinstance(updated_at_epoch, int):
        is_stale = (current_ts - updated_at_epoch) > (STALE_SEC * 2)

    return {
        "reader_id": rid,
        "location": location,
        "rssi": last_rssi,
        "updated_at": updated_at_epoch,
        "is_stale": is_stale,
    }


def fetch_tag_by_nfc_token(cur, token: str):
    sql = """
    SELECT
      t.tag_id,
      t.equipment_name,
      t.equipment_type,
      t.serial_number,
      t.nfc_tag_uid,
      t.asset_status,
      t.current_holder_user_id,
      COALESCE(u.display_name, u.username) AS current_holder_name,
      t.current_usage_id,
      t.is_active
    FROM tags t
    LEFT JOIN users u ON u.user_id = t.current_holder_user_id
    WHERE t.nfc_tag_uid = %s
    FOR UPDATE OF t
    """
    cur.execute(sql, (token,))
    return cur.fetchone()


def insert_nfc_event(
    cur,
    *,
    usage_id: int | None,
    tag_id: str,
    user_id: int | None,
    equipment_nfc_uid: str,
    action: str,
    result: str,
    reader_id: str | None,
    location_name: str | None,
    reason: str | None,
):
    sql = """
    INSERT INTO usage_nfc_events (
      usage_id, tag_id, user_id, equipment_nfc_uid, action, result, reader_id, location_name, reason, occurred_at
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, now())
    """
    cur.execute(
        sql,
        (usage_id, tag_id, user_id, equipment_nfc_uid, action, result, reader_id, location_name, reason),
    )


def fetch_usage_integrity_source(usage_id: int) -> dict | None:
    sql = """
    SELECT
      h.usage_id,
      h.usage_status,
      h.user_id,
      h.user_name,
      h.user_position,
      h.user_department,
      h.returned_by_user_id,
      h.returned_by_name,
      h.returned_by_position,
      h.returned_by_department,
      h.tag_id,
      h.equipment_name,
      h.equipment_type,
      h.equipment_serial_number,
      h.equipment_nfc_uid,
      h.checkout_method,
      h.checkout_reader_id,
      h.checkout_location,
      EXTRACT(EPOCH FROM h.checkout_at)::BIGINT AS checkout_at_epoch,
      h.return_method,
      h.return_reader_id,
      h.return_location,
      EXTRACT(EPOCH FROM h.returned_at)::BIGINT AS returned_at_epoch,
      EXTRACT(EPOCH FROM h.created_at)::BIGINT AS created_at_epoch
    FROM usage_history h
    WHERE h.usage_id = %s
    LIMIT 1
    """
    try:
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            cur.execute(sql, (usage_id,))
            row = cur.fetchone()
    except Exception:
        raise HTTPException(500, "사용 이력 무결성 조회 중 데이터베이스 오류가 발생했습니다.")

    if not row:
        return None

    return {
        "usage_id": row[0],
        "usage_status": row[1],
        "user_id": row[2],
        "user_name": row[3],
        "user_position": row[4],
        "user_department": row[5],
        "returned_by_user_id": row[6],
        "returned_by_name": row[7],
        "returned_by_position": row[8],
        "returned_by_department": row[9],
        "tag_id": row[10],
        "equipment_name": row[11],
        "equipment_type": row[12],
        "equipment_serial_number": row[13],
        "equipment_nfc_uid": row[14],
        "checkout_method": row[15],
        "checkout_reader_id": row[16],
        "checkout_location": row[17],
        "checkout_at": row[18],
        "return_method": row[19],
        "return_reader_id": row[20],
        "return_location": row[21],
        "returned_at": row[22],
        "created_at": row[23],
    }


def build_usage_integrity_payload(source: dict) -> dict:
    return {
        "usage_id": str(source["usage_id"]),
        "usage_status": source["usage_status"],
        "user": {
            "user_id": source["user_id"],
            "name": source["user_name"],
            "position": source["user_position"],
            "department": source["user_department"],
        },
        "returned_by": {
            "user_id": source["returned_by_user_id"],
            "name": source["returned_by_name"],
            "position": source["returned_by_position"],
            "department": source["returned_by_department"],
        },
        "equipment": {
            "tag_id": source["tag_id"],
            "name": source["equipment_name"],
            "type": source["equipment_type"],
            "serial_number": source["equipment_serial_number"],
            "nfc_token": source["equipment_nfc_uid"],
        },
        "checkout": {
            "method": source["checkout_method"],
            "reader_id": source["checkout_reader_id"],
            "location": source["checkout_location"],
            "at": source["checkout_at"],
        },
        "return": {
            "method": source["return_method"],
            "reader_id": source["return_reader_id"],
            "location": source["return_location"],
            "at": source["returned_at"],
        },
        "created_at": source["created_at"],
    }


def compute_usage_hash(payload: dict) -> str:
    canonical_json = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()
    return f"0x{digest}"


def is_besu_ready() -> tuple[bool, str | None]:
    if not BESU_DEPLOYMENT_PATH.exists():
        return False, "배포된 UsageHashRegistry 컨트랙트 정보가 없습니다."
    if not (BESU_DIR / "node_modules").exists():
        return False, "blockchain/besu 의 npm 의존성이 설치되지 않았습니다."
    return True, None


def run_besu_script(script_name: str, *args: str) -> tuple[bool, str, str]:
    env = os.environ.copy()
    process = subprocess.run(
        ["node", f"scripts/{script_name}", *args],
        cwd=BESU_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
    )
    return process.returncode == 0, process.stdout.strip(), process.stderr.strip()


def read_usage_hash_from_chain(usage_id: int) -> dict:
    ready, reason = is_besu_ready()
    if not ready:
        return {
            "status": "not_configured",
            "detail": reason,
            "exists": False,
        }

    ok, stdout, stderr = run_besu_script("read-usage-hash.mjs", str(usage_id))
    if not ok:
        return {
            "status": "read_error",
            "detail": stderr or stdout or "온체인 조회에 실패했습니다.",
            "exists": False,
        }

    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError:
        return {
            "status": "read_error",
            "detail": "온체인 조회 응답을 해석하지 못했습니다.",
            "exists": False,
        }

    return {
        "status": "ok",
        "detail": None,
        "exists": bool(payload.get("exists")),
        "usage_hash": payload.get("usageHash"),
        "recorded_at": payload.get("recordedAt"),
        "recorder": payload.get("recorder"),
    }


def anchor_usage_hash_to_chain(usage_id: int, usage_hash: str) -> dict:
    ready, reason = is_besu_ready()
    if not ready:
        return {
            "ok": False,
            "status": "not_configured",
            "detail": reason,
        }

    existing = read_usage_hash_from_chain(usage_id)
    if existing["status"] == "ok" and existing["exists"]:
        onchain_hash = existing.get("usage_hash")
        if onchain_hash and onchain_hash.lower() != usage_hash.lower():
            return {
                "ok": False,
                "status": "mismatch",
                "detail": "이미 다른 해시가 온체인에 기록되어 있습니다.",
                "usage_hash": usage_hash,
                "onchain_hash": onchain_hash,
            }
        return {
            "ok": True,
            "status": "already_anchored",
            "detail": None,
            "usage_hash": usage_hash,
            "onchain_hash": onchain_hash,
            "recorded_at": existing.get("recorded_at"),
            "recorder": existing.get("recorder"),
        }
    if existing["status"] not in ("ok", "not_configured") and existing["status"] != "read_error":
        return {
            "ok": False,
            "status": existing["status"],
            "detail": existing.get("detail"),
        }

    ok, stdout, stderr = run_besu_script("record-usage-hash.mjs", str(usage_id), usage_hash)
    if not ok:
        return {
            "ok": False,
            "status": "record_error",
            "detail": stderr or stdout or "온체인 기록에 실패했습니다.",
        }

    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError:
        return {
            "ok": False,
            "status": "record_error",
            "detail": "온체인 기록 응답을 해석하지 못했습니다.",
        }

    return {
        "ok": True,
        "status": "anchored",
        "detail": None,
        "usage_hash": usage_hash,
        "onchain_hash": payload.get("usageHash"),
        "transaction_hash": payload.get("txHash"),
        "block_number": payload.get("blockNumber"),
    }


def verify_usage_against_chain(usage_id: int) -> dict:
    source = fetch_usage_integrity_source(usage_id)
    if not source:
        raise HTTPException(404, "사용 이력을 찾을 수 없습니다.")

    payload = build_usage_integrity_payload(source)
    recalculated_hash = compute_usage_hash(payload)
    chain_record = read_usage_hash_from_chain(usage_id)

    if chain_record["status"] == "not_configured":
        return {
            "ok": True,
            "usage_id": usage_id,
            "verification_status": "not_configured",
            "detail": chain_record["detail"],
            "recalculated_hash": recalculated_hash,
            "onchain_hash": None,
            "onchain_exists": False,
            "payload": payload,
        }
    if chain_record["status"] != "ok":
        return {
            "ok": True,
            "usage_id": usage_id,
            "verification_status": "chain_error",
            "detail": chain_record["detail"],
            "recalculated_hash": recalculated_hash,
            "onchain_hash": None,
            "onchain_exists": False,
            "payload": payload,
        }
    if not chain_record["exists"]:
        return {
            "ok": True,
            "usage_id": usage_id,
            "verification_status": "not_anchored",
            "detail": "온체인에 아직 기록되지 않았습니다.",
            "recalculated_hash": recalculated_hash,
            "onchain_hash": None,
            "onchain_exists": False,
            "payload": payload,
        }

    onchain_hash = (chain_record.get("usage_hash") or "").lower()
    matches = onchain_hash == recalculated_hash.lower()
    return {
        "ok": True,
        "usage_id": usage_id,
        "verification_status": "match" if matches else "mismatch",
        "detail": None if matches else "현재 DB 원문을 재계산한 해시와 온체인 해시가 다릅니다.",
        "recalculated_hash": recalculated_hash,
        "onchain_hash": chain_record.get("usage_hash"),
        "onchain_exists": True,
        "recorded_at": chain_record.get("recorded_at"),
        "recorder": chain_record.get("recorder"),
        "payload": payload,
    }


@app.post("/auth/register")
def register(body: RegisterRequest):
    username = body.username.strip()
    display_name = body.display_name.strip()
    role = body.role.strip().lower()
    password = body.password
    position = body.position.strip() if body.position else None
    department = body.department.strip() if body.department else None

    if not username or not display_name or not password:
        raise HTTPException(400, "username, display_name, password는 필수입니다.")

    if role not in ("admin", "staff"):
        raise HTTPException(400, "role은 admin 또는 staff여야 합니다.")
    if role == "staff" and not position:
        raise HTTPException(400, "staff 계정은 position이 필수입니다.")

    password_hash = pwd.hash(password)

    sql = """
    INSERT INTO users (username, display_name, role, department, position, password_hash, is_active, created_at)
    VALUES (%s, %s, %s, %s, %s, %s, %s, now())
    RETURNING user_id, username, display_name, role, department, position, is_active
    """
    try:
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            cur.execute(
                sql,
                (
                    username,
                    display_name,
                    role,
                    department,
                    position,
                    password_hash,
                    body.is_active,
                ),
            )
            row = cur.fetchone()
    except psycopg.errors.UniqueViolation:
        raise HTTPException(409, "이미 존재하는 username입니다.")
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
            "is_active": row[6],
        },
    }


@app.post("/auth/login")
def login(body: LoginRequest):
    username = body.username.strip()
    requested_role = body.role.strip().lower()
    if not username or not body.password or not requested_role:
        raise HTTPException(400, "username, password, role은 필수입니다.")
    if requested_role not in ("admin", "staff"):
        raise HTTPException(400, "role은 admin 또는 staff여야 합니다.")

    sql = """
    SELECT user_id, username, display_name, role, department, position, password_hash, is_active
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

    user_id, db_username, display_name, role, department, position, password_hash, is_active = row

    if not is_active:
        raise HTTPException(403, "비활성화된 계정입니다.")

    if not pwd.verify(body.password, password_hash):
        raise HTTPException(401, "아이디 또는 비밀번호가 올바르지 않습니다.")
    if role != requested_role:
        raise HTTPException(403, "선택한 권한과 계정 권한이 일치하지 않습니다.")

    return {
        "ok": True,
        "user": {
            "user_id": user_id,
            "username": db_username,
            "display_name": display_name,
            "role": role,
            "department": department,
            "position": position,
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

    insert_location_history(db_updates)

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
    snapshot = resolve_tag_location_snapshot(tag_id)
    if not snapshot:
        return {"ok": False, "reason": "unknown"}

    return {
        "ok": True,
        "tag_id": tag_id,
        "reader_id": snapshot["reader_id"],
        "location": snapshot["location"],
        "rssi": snapshot["rssi"],
        "updated_at": snapshot["updated_at"],
        "is_stale": snapshot["is_stale"],
    }


@app.get("/admin/nfc-mappings")
def list_nfc_mappings():
    sql = """
    SELECT
      t.tag_id,
      t.equipment_name,
      t.equipment_type,
      t.serial_number,
      t.nfc_tag_uid,
      t.asset_status,
      t.is_active
    FROM tags t
    WHERE t.is_active = TRUE
    ORDER BY t.equipment_name ASC, t.tag_id ASC
    """
    try:
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()
    except Exception:
        raise HTTPException(500, "NFC 매핑 목록 조회 중 데이터베이스 오류가 발생했습니다.")

    now = int(time.time())
    reader_locations = load_reader_location_map()
    items = []
    for row in rows:
        location_snapshot = resolve_tag_location_snapshot(row[0], now=now, reader_locations=reader_locations)
        items.append(
            {
                "tag_id": row[0],
                "equipment_name": row[1],
                "equipment_type": row[2],
                "serial_number": row[3],
                "nfc_token": row[4],
                "asset_status": row[5],
                "is_active": row[6],
                "reader_id": location_snapshot["reader_id"] if location_snapshot else None,
                "location": location_snapshot["location"] if location_snapshot else None,
                "updated_at": location_snapshot["updated_at"] if location_snapshot else None,
                "is_stale": location_snapshot["is_stale"] if location_snapshot else True,
            }
        )

    return {
        "ok": True,
        "count": len(items),
        "items": items,
    }


@app.post("/admin/nfc-mappings")
def upsert_nfc_mapping(body: NfcMappingUpsertRequest):
    require_admin_actor(body.actor_role)
    tag_id = body.tag_id.strip()
    token = normalize_nfc_token(body.nfc_token)
    if not tag_id:
        raise HTTPException(400, "tag_id는 필수입니다.")

    sql = """
    UPDATE tags
    SET nfc_tag_uid = %s, updated_at = now()
    WHERE tag_id = %s
    RETURNING tag_id, equipment_name, equipment_type, serial_number, nfc_tag_uid, asset_status
    """
    try:
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            cur.execute(sql, (token, tag_id))
            row = cur.fetchone()
    except psycopg.errors.UniqueViolation:
        raise HTTPException(409, "이미 다른 장비에 매핑된 NFC 토큰입니다.")
    except Exception:
        raise HTTPException(500, "NFC 매핑 저장 중 데이터베이스 오류가 발생했습니다.")

    if not row:
        raise HTTPException(404, "장비를 찾을 수 없습니다.")

    return {
        "ok": True,
        "item": {
            "tag_id": row[0],
            "equipment_name": row[1],
            "equipment_type": row[2],
            "serial_number": row[3],
            "nfc_token": row[4],
            "asset_status": row[5],
        },
    }


@app.delete("/admin/nfc-mappings/{tag_id}")
def remove_nfc_mapping(tag_id: str, actor_role: str | None = None):
    require_admin_actor(actor_role)
    clean_tag_id = tag_id.strip()
    if not clean_tag_id:
        raise HTTPException(400, "tag_id는 필수입니다.")

    sql = """
    UPDATE tags
    SET nfc_tag_uid = NULL, updated_at = now()
    WHERE tag_id = %s
    RETURNING tag_id
    """
    try:
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            cur.execute(sql, (clean_tag_id,))
            row = cur.fetchone()
    except Exception:
        raise HTTPException(500, "NFC 매핑 해제 중 데이터베이스 오류가 발생했습니다.")

    if not row:
        raise HTTPException(404, "장비를 찾을 수 없습니다.")

    return {
        "ok": True,
        "tag_id": row[0],
    }


@app.get("/nfc/{token}")
def get_nfc_equipment(token: str):
    clean_token = normalize_nfc_token(token)

    sql = """
    SELECT
      t.tag_id,
      t.equipment_name,
      t.equipment_type,
      t.serial_number,
      t.nfc_tag_uid,
      t.asset_status,
      t.current_holder_user_id,
      COALESCE(u.display_name, u.username) AS current_holder_name,
      t.current_usage_id
    FROM tags t
    LEFT JOIN users u ON u.user_id = t.current_holder_user_id
    WHERE t.nfc_tag_uid = %s
      AND t.is_active = TRUE
    LIMIT 1
    """
    try:
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            cur.execute(sql, (clean_token,))
            row = cur.fetchone()
    except Exception:
        raise HTTPException(500, "NFC 장비 조회 중 데이터베이스 오류가 발생했습니다.")

    if not row:
        raise HTTPException(404, "매핑되지 않은 NFC 태그입니다.")

    location_snapshot = resolve_tag_location_snapshot(row[0])
    return {
        "ok": True,
        "item": {
            "tag_id": row[0],
            "equipment_name": row[1],
            "equipment_type": row[2],
            "serial_number": row[3],
            "nfc_token": row[4],
            "asset_status": row[5],
            "current_holder_user_id": row[6],
            "current_holder_name": row[7],
            "current_usage_id": row[8],
            "reader_id": location_snapshot["reader_id"] if location_snapshot else None,
            "location": location_snapshot["location"] if location_snapshot else None,
            "updated_at": location_snapshot["updated_at"] if location_snapshot else None,
            "is_stale": location_snapshot["is_stale"] if location_snapshot else True,
        },
    }


@app.post("/usage/checkout")
def usage_checkout(body: NfcUsageActionRequest):
    actor = validate_usage_actor(body)
    token = normalize_nfc_token(body.nfc_token)
    now = dt.datetime.now(dt.timezone.utc)

    try:
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            tag_row = fetch_tag_by_nfc_token(cur, token)
            if not tag_row or not tag_row[9]:
                raise HTTPException(404, "매핑된 장비를 찾을 수 없습니다.")

            (
                tag_id,
                equipment_name,
                equipment_type,
                serial_number,
                nfc_uid,
                asset_status,
                current_holder_user_id,
                current_holder_name,
                current_usage_id,
                _is_active,
            ) = tag_row

            location_snapshot = resolve_tag_location_snapshot(tag_id)
            reader_id = location_snapshot["reader_id"] if location_snapshot else None
            location_name = location_snapshot["location"] if location_snapshot else None

            if asset_status == "checked_out":
                raise HTTPException(
                    409,
                    f"이미 사용 중인 장비입니다. 현재 사용자: {current_holder_name or current_holder_user_id or '알 수 없음'}",
                )
            if asset_status != "available":
                raise HTTPException(409, f"현재 상태({asset_status})에서는 사용 시작할 수 없습니다.")

            cur.execute(
                """
                INSERT INTO usage_history (
                  usage_status,
                  user_id,
                  user_name,
                  user_position,
                  user_department,
                  tag_id,
                  equipment_name,
                  equipment_type,
                  equipment_serial_number,
                  equipment_nfc_uid,
                  checkout_method,
                  checkout_reader_id,
                  checkout_location,
                  checkout_at,
                  created_at,
                  updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now(), now())
                RETURNING usage_id
                """,
                (
                    "checked_out",
                    actor["user_id"],
                    actor["display_name"],
                    actor["position"],
                    actor["department"],
                    tag_id,
                    equipment_name,
                    equipment_type,
                    serial_number,
                    nfc_uid,
                    "nfc",
                    reader_id,
                    location_name,
                    now,
                ),
            )
            usage_id = cur.fetchone()[0]

            cur.execute(
                """
                UPDATE tags
                SET
                  asset_status = 'checked_out',
                  current_holder_user_id = %s,
                  current_usage_id = %s,
                  last_checkout_at = %s,
                  updated_at = now()
                WHERE tag_id = %s
                """,
                (actor["user_id"], usage_id, now, tag_id),
            )

            insert_nfc_event(
                cur,
                usage_id=usage_id,
                tag_id=tag_id,
                user_id=actor["user_id"],
                equipment_nfc_uid=nfc_uid,
                action="checkout",
                result="accepted",
                reader_id=reader_id,
                location_name=location_name,
                reason=None,
            )
            conn.commit()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(500, "장비 사용 시작 처리 중 데이터베이스 오류가 발생했습니다.")

    return {
        "ok": True,
        "usage_id": usage_id,
        "tag_id": tag_id,
        "asset_status": "checked_out",
        "current_holder_user_id": actor["user_id"],
        "current_holder_name": actor["display_name"],
    }


@app.post("/usage/return")
def usage_return(body: NfcUsageActionRequest):
    actor = validate_usage_actor(body)
    token = normalize_nfc_token(body.nfc_token)
    now = dt.datetime.now(dt.timezone.utc)

    anchor_result = None

    try:
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            tag_row = fetch_tag_by_nfc_token(cur, token)
            if not tag_row or not tag_row[9]:
                raise HTTPException(404, "매핑된 장비를 찾을 수 없습니다.")

            (
                tag_id,
                _equipment_name,
                _equipment_type,
                _serial_number,
                nfc_uid,
                asset_status,
                current_holder_user_id,
                current_holder_name,
                current_usage_id,
                _is_active,
            ) = tag_row

            location_snapshot = resolve_tag_location_snapshot(tag_id)
            reader_id = location_snapshot["reader_id"] if location_snapshot else None
            location_name = location_snapshot["location"] if location_snapshot else None

            if asset_status != "checked_out" or not current_usage_id:
                raise HTTPException(409, "현재 사용 중인 장비가 아닙니다.")
            if actor["role"] != "admin" and current_holder_user_id != actor["user_id"]:
                raise HTTPException(
                    403,
                    f"이 장비는 {current_holder_name or current_holder_user_id or '다른 사용자'}가 사용 중입니다.",
                )

            cur.execute(
                """
                UPDATE usage_history
                SET
                  usage_status = 'returned',
                  returned_by_user_id = %s,
                  returned_by_name = %s,
                  returned_by_position = %s,
                  returned_by_department = %s,
                  return_method = 'nfc',
                  return_reader_id = %s,
                  return_location = %s,
                  returned_at = %s,
                  updated_at = now()
                WHERE usage_id = %s
                """,
                (
                    actor["user_id"],
                    actor["display_name"],
                    actor["position"],
                    actor["department"],
                    reader_id,
                    location_name,
                    now,
                    current_usage_id,
                ),
            )

            cur.execute(
                """
                UPDATE tags
                SET
                  asset_status = 'available',
                  current_holder_user_id = NULL,
                  current_usage_id = NULL,
                  last_returned_at = %s,
                  updated_at = now()
                WHERE tag_id = %s
                """,
                (now, tag_id),
            )

            insert_nfc_event(
                cur,
                usage_id=current_usage_id,
                tag_id=tag_id,
                user_id=actor["user_id"],
                equipment_nfc_uid=nfc_uid,
                action="return",
                result="accepted",
                reader_id=reader_id,
                location_name=location_name,
                reason=None,
            )
            conn.commit()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(500, "장비 사용 종료 처리 중 데이터베이스 오류가 발생했습니다.")

    try:
        source = fetch_usage_integrity_source(current_usage_id)
        if source:
            payload = build_usage_integrity_payload(source)
            usage_hash = compute_usage_hash(payload)
            anchor_result = anchor_usage_hash_to_chain(current_usage_id, usage_hash)
    except Exception:
        anchor_result = {
            "ok": False,
            "status": "record_error",
            "detail": "반납 후 온체인 기록 중 오류가 발생했습니다.",
        }

    return {
        "ok": True,
        "usage_id": current_usage_id,
        "tag_id": tag_id,
        "asset_status": "available",
        "current_holder_user_id": None,
        "current_holder_name": None,
        "blockchain": anchor_result,
    }


@app.get("/rtls/live")
def rtls_live():
    now = int(time.time())
    reader_locations = load_reader_location_map()
    tag_metadata = load_tag_metadata(set(tag_state.keys()))

    items = []
    for tag_id, state in tag_state.items():
        reader_id = state.get("current_reader")
        if not reader_id:
            continue

        metadata = tag_metadata.get(tag_id, {})
        updated_at_epoch = state.get("updated_at")
        last_rssi = state.get("current_rssi")
        is_stale = False
        if isinstance(updated_at_epoch, int):
            is_stale = (now - updated_at_epoch) > (STALE_SEC * 2)
        items.append(
            {
                "tag_id": tag_id,
                "equipment_name": metadata.get("equipment_name"),
                "equipment_type": metadata.get("equipment_type"),
                "serial_number": metadata.get("serial_number"),
                "asset_status": metadata.get("asset_status") or "available",
                "current_holder_user_id": metadata.get("current_holder_user_id"),
                "current_holder_name": metadata.get("current_holder_name"),
                "reader_id": reader_id,
                "location": reader_locations.get(reader_id, READER_LOCATION.get(reader_id, reader_id)),
                "rssi": last_rssi,
                "updated_at": updated_at_epoch,
                "is_stale": is_stale,
            }
        )

    items.sort(key=lambda item: item.get("updated_at") or 0, reverse=True)

    readers = [
        {"reader_id": reader_id, "location": location}
        for reader_id, location in sorted(reader_locations.items())
    ]

    return {
        "ok": True,
        "count": len(items),
        "ts": now,
        "items": items,
        "readers": readers,
    }


@app.get("/usage/history")
def usage_history(user: str | None = None, equipment: str | None = None, date: str | None = None, limit: int = 200):
    safe_limit, rows = query_usage_history_rows(user=user, equipment=equipment, date=date, limit=limit, max_limit=1000)

    items = []
    for row in rows:
        verification = verify_usage_against_chain(row[0])
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
                "created_at": row[13],
                "verification": {
                    "verification_status": verification.get("verification_status"),
                    "detail": verification.get("detail"),
                    "recalculated_hash": verification.get("recalculated_hash"),
                    "onchain_hash": verification.get("onchain_hash"),
                    "onchain_exists": verification.get("onchain_exists"),
                    "recorded_at": verification.get("recorded_at"),
                    "recorder": verification.get("recorder"),
                },
            }
        )

    return {
        "ok": True,
        "count": len(items),
        "filters": {
            "user": user,
            "equipment": equipment,
            "date": date,
            "limit": safe_limit,
        },
        "items": items,
    }


def query_usage_history_rows(
    user: str | None,
    equipment: str | None,
    date: str | None,
    limit: int,
    max_limit: int,
):
    safe_limit = max(1, min(limit, max_limit))
    where_clauses = []
    params: list = []

    if user and user.strip():
        q = f"%{user.strip()}%"
        where_clauses.append("(h.user_name ILIKE %s OR CAST(h.user_id AS TEXT) ILIKE %s)")
        params.extend([q, q])

    if equipment and equipment.strip():
        q = f"%{equipment.strip()}%"
        where_clauses.append("(h.equipment_name ILIKE %s OR h.tag_id ILIKE %s)")
        params.extend([q, q])

    if date and date.strip():
        try:
            target_date = dt.date.fromisoformat(date.strip())
        except ValueError:
            raise HTTPException(400, "date는 YYYY-MM-DD 형식이어야 합니다.")
        where_clauses.append("h.checkout_at::date = %s")
        params.append(target_date)

    where_sql = ""
    if where_clauses:
        where_sql = "WHERE " + " AND ".join(where_clauses)

    sql = f"""
    SELECT
      h.usage_id,
      h.user_id,
      h.user_name,
      h.user_position,
      h.user_department,
      h.tag_id,
      h.equipment_name,
      h.checkout_reader_id,
      h.checkout_location,
      EXTRACT(EPOCH FROM h.checkout_at)::BIGINT AS checkout_at_epoch,
      h.return_reader_id,
      h.return_location,
      EXTRACT(EPOCH FROM h.returned_at)::BIGINT AS returned_at_epoch,
      EXTRACT(EPOCH FROM h.created_at)::BIGINT AS created_at_epoch
    FROM usage_history h
    {where_sql}
    ORDER BY h.checkout_at DESC
    LIMIT %s
    """
    params.append(safe_limit)

    try:
        with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
    except Exception:
        raise HTTPException(500, "사용 이력 조회 중 데이터베이스 오류가 발생했습니다.")

    return safe_limit, rows


def format_epoch_to_text(epoch: int | None) -> str:
    if epoch is None:
        return ""
    return dt.datetime.fromtimestamp(epoch).strftime("%Y-%m-%d %H:%M:%S")


@app.get("/usage/history/export")
def usage_history_export(user: str | None = None, equipment: str | None = None, date: str | None = None, limit: int = 10000):
    safe_limit, rows = query_usage_history_rows(user=user, equipment=equipment, date=date, limit=limit, max_limit=50000)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "usage_id",
            "user_id",
            "user_name",
            "user_position",
            "user_department",
            "tag_id",
            "equipment_name",
            "checkout_reader_id",
            "checkout_location",
            "checkout_at",
            "return_reader_id",
            "return_location",
            "returned_at",
            "created_at",
        ]
    )

    for row in rows:
        writer.writerow(
            [
                row[0],
                row[1],
                row[2] or "",
                row[3] or "",
                row[4] or "",
                row[5] or "",
                row[6] or "",
                row[7] or "",
                row[8] or "",
                format_epoch_to_text(row[9]),
                row[10] or "",
                row[11] or "",
                format_epoch_to_text(row[12]),
                format_epoch_to_text(row[13]),
            ]
        )

    ts = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"usage_history_{ts}.csv"
    content = output.getvalue().encode("utf-8-sig")

    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Export-Count": str(len(rows)),
            "X-Export-Limit": str(safe_limit),
        },
    )

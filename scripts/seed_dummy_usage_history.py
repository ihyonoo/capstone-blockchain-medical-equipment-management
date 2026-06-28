#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import json
import os
import subprocess
from pathlib import Path

import psycopg


ROOT_DIR = Path(__file__).resolve().parents[1]
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/rtls")
BESU_DIR = ROOT_DIR / "blockchain" / "besu"
DEPLOYMENT_PATH = BESU_DIR / "deployments" / "usage-registry.json"
SEED_MARKER = "seed_demo_2026_05_19"

USER_SPECS = [
    ("seed_demo_20260519_staff_01", "최현우", "응급실", "간호사"),
    ("seed_demo_20260519_staff_02", "김민성", "중환자실", "간호사"),
    ("seed_demo_20260519_staff_03", "이윤지", "수술실", "간호사"),
    ("seed_demo_20260519_staff_04", "박서준", "영상의학과", "방사선사"),
    ("seed_demo_20260519_staff_05", "정다은", "병동", "간호사"),
    ("seed_demo_20260519_staff_06", "한지훈", "응급실", "응급구조사"),
    ("seed_demo_20260519_staff_07", "오세린", "중환자실", "간호사"),
    ("seed_demo_20260519_staff_08", "강민재", "수술실", "간호조무사"),
]

EQUIPMENT_SPECS = [
    ("seed-demo-20260519-tag-01", "제세동기", "응급장비"),
    ("seed-demo-20260519-tag-02", "인퓨전 펌프", "주입장비"),
    ("seed-demo-20260519-tag-03", "휠체어", "이동보조"),
    ("seed-demo-20260519-tag-04", "환자감시장치", "모니터링"),
    ("seed-demo-20260519-tag-05", "이동식 초음파", "영상장비"),
    ("seed-demo-20260519-tag-06", "산소포화도 측정기", "모니터링"),
    ("seed-demo-20260519-tag-07", "심전도기", "진단장비"),
    ("seed-demo-20260519-tag-08", "흡인기", "처치장비"),
    ("seed-demo-20260519-tag-09", "운반용 스트레처", "이송장비"),
]

USAGE_PLAN = [
    (0, 0, 0, 2, "M501", "M501", 25, 55),
    (1, 1, 1, 1, "M502", "M501", 22, 44),
    (2, 2, 2, 2, "M501", "M502", 18, 37),
    (3, 3, 3, 4, "M502", "M502", 41, 65),
    (4, 4, 4, 4, "M501", "M501", 30, 58),
    (5, 5, 5, 6, "M502", "M501", 27, 49),
    (6, 6, 6, 6, "M501", "M502", 24, 52),
    (7, 7, 7, 0, "M502", "M502", 33, 71),
    (8, 0, 8, 0, "M501", "M501", 20, 42),
    (9, 1, 1, 2, "M502", "M502", 29, 63),
    (10, 2, 2, 2, "M501", "M501", 35, 67),
    (11, 3, 3, 4, "M502", "M501", 26, 46),
    (12, 4, 4, 5, "M501", "M502", 31, 59),
    (13, 5, 5, 5, "M502", "M502", 28, 53),
    (14, 6, 6, 7, "M501", "M501", 17, 34),
    (15, 7, 7, 0, "M502", "M501", 39, 74),
    (16, 0, 8, 1, "M501", "M502", 23, 47),
    (17, 1, 2, 3, "M502", "M501", 32, 60),
]


def run_besu_script(script_name: str, *args: str) -> dict:
    process = subprocess.run(
        ["node", f"scripts/{script_name}", *args],
        cwd=BESU_DIR,
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    if process.returncode != 0:
        detail = process.stderr.strip() or process.stdout.strip() or "unknown blockchain error"
        raise RuntimeError(f"{script_name} failed: {detail}")
    return json.loads(process.stdout)


def ensure_prerequisites() -> None:
    if not DEPLOYMENT_PATH.exists():
        raise SystemExit("missing blockchain deployment file")
    if not (BESU_DIR / "node_modules").exists():
        raise SystemExit("missing blockchain dependencies in blockchain/besu/node_modules")


def create_dummy_users(cur) -> list[dict]:
    users: list[dict] = []
    for username, display_name, department, position in USER_SPECS:
        cur.execute(
            """
            INSERT INTO users (
              username, display_name, role, department, position, password_hash, is_active, created_at, updated_at
            )
            VALUES (%s, %s, 'staff', %s, %s, %s, TRUE, now(), now())
            ON CONFLICT (username) DO UPDATE
            SET
              display_name = EXCLUDED.display_name,
              department = EXCLUDED.department,
              position = EXCLUDED.position,
              is_active = TRUE,
              updated_at = now()
            RETURNING user_id, username, display_name, department, position
            """,
            (username, display_name, department, position, "seed-demo-password"),
        )
        row = cur.fetchone()
        users.append(
            {
                "user_id": row[0],
                "username": row[1],
                "display_name": row[2],
                "department": row[3],
                "position": row[4],
            }
        )
    return users


def create_dummy_tags(cur) -> list[dict]:
    tags: list[dict] = []
    for index, (tag_id, equipment_name, equipment_type) in enumerate(EQUIPMENT_SPECS, start=1):
        serial = f"SEED-DEMO-20260519-{index:03d}"
        nfc_uid = f"seed-demo-20260519-nfc-{index:03d}"
        cur.execute(
            """
            INSERT INTO tags (
              tag_id,
              equipment_name,
              equipment_type,
              serial_number,
              nfc_tag_uid,
              asset_status,
              current_holder_user_id,
              current_usage_id,
              last_checkout_at,
              last_returned_at,
              is_active,
              created_at,
              updated_at
            )
            VALUES (%s, %s, %s, %s, %s, 'available', NULL, NULL, NULL, NULL, TRUE, now(), now())
            ON CONFLICT (tag_id) DO UPDATE
            SET
              equipment_name = EXCLUDED.equipment_name,
              equipment_type = EXCLUDED.equipment_type,
              serial_number = EXCLUDED.serial_number,
              nfc_tag_uid = EXCLUDED.nfc_tag_uid,
              asset_status = 'available',
              current_holder_user_id = NULL,
              current_usage_id = NULL,
              updated_at = now()
            RETURNING tag_id, equipment_name, equipment_type, serial_number, nfc_tag_uid
            """,
            (tag_id, equipment_name, equipment_type, serial, nfc_uid),
        )
        row = cur.fetchone()
        tags.append(
            {
                "tag_id": row[0],
                "equipment_name": row[1],
                "equipment_type": row[2],
                "serial_number": row[3],
                "nfc_tag_uid": row[4],
            }
        )
    return tags


def delete_existing_seed_data(cur) -> None:
    cur.execute(
        """
        DELETE FROM usage_nfc_events
        WHERE usage_id IN (
          SELECT usage_id FROM usage_history WHERE note = %s
        )
        """,
        (SEED_MARKER,),
    )
    cur.execute("DELETE FROM usage_history WHERE note = %s", (SEED_MARKER,))


def build_blockchain_record(row: dict) -> dict:
    return {
        "usageId": str(row["usage_id"]),
        "checkoutUserId": row["checkout_user_id"],
        "returnUserId": row["return_user_id"],
        "tagId": row["tag_id"],
        "checkoutReaderId": row["checkout_reader_id"],
        "checkoutLocation": row["checkout_location"],
        "checkoutAt": row["checkout_at"],
        "returnReaderId": row["return_reader_id"],
        "returnLocation": row["return_location"],
        "returnedAt": row["returned_at"],
    }


def insert_usage_rows(cur, users: list[dict], tags: list[dict]) -> list[dict]:
    inserted_rows: list[dict] = []
    base_checkout = dt.datetime(2026, 5, 2, 8, 30, tzinfo=dt.timezone.utc)

    for usage_offset, user_idx, tag_idx, returned_by_idx, checkout_reader, return_reader, start_hour_delta, duration_minutes in USAGE_PLAN:
        borrower = users[user_idx]
        returner = users[returned_by_idx]
        tag = tags[tag_idx]

        checkout_at = base_checkout + dt.timedelta(days=usage_offset, hours=start_hour_delta)
        returned_at = checkout_at + dt.timedelta(minutes=duration_minutes)
        created_at = checkout_at - dt.timedelta(minutes=3)
        updated_at = returned_at + dt.timedelta(minutes=1)

        cur.execute(
            """
            INSERT INTO usage_history (
              usage_status,
              user_id,
              user_name,
              user_position,
              user_department,
              returned_by_user_id,
              returned_by_name,
              returned_by_position,
              returned_by_department,
              tag_id,
              equipment_name,
              equipment_type,
              equipment_serial_number,
              equipment_nfc_uid,
              checkout_method,
              checkout_reader_id,
              checkout_location,
              checkout_at,
              return_method,
              return_reader_id,
              return_location,
              returned_at,
              note,
              created_at,
              updated_at
            )
            VALUES (
              'returned', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
              'test', %s, %s, %s, 'test', %s, %s, %s, %s, %s, %s
            )
            RETURNING usage_id
            """,
            (
                borrower["user_id"],
                borrower["display_name"],
                borrower["position"],
                borrower["department"],
                returner["user_id"],
                returner["display_name"],
                returner["position"],
                returner["department"],
                tag["tag_id"],
                tag["equipment_name"],
                tag["equipment_type"],
                tag["serial_number"],
                tag["nfc_tag_uid"],
                checkout_reader,
                checkout_reader,
                checkout_at,
                return_reader,
                return_reader,
                returned_at,
                SEED_MARKER,
                created_at,
                updated_at,
            ),
        )
        usage_id = cur.fetchone()[0]

        inserted_rows.append(
            {
                "usage_id": usage_id,
                "checkout_user_id": borrower["user_id"],
                "return_user_id": returner["user_id"],
                "tag_id": tag["tag_id"],
                "checkout_reader_id": checkout_reader,
                "checkout_location": checkout_reader,
                "checkout_at": int(checkout_at.timestamp()),
                "return_reader_id": return_reader,
                "return_location": return_reader,
                "returned_at": int(returned_at.timestamp()),
            }
        )

    latest_return_by_tag: dict[str, dt.datetime] = {}
    for item in inserted_rows:
        returned_at = dt.datetime.fromtimestamp(item["returned_at"], tz=dt.timezone.utc)
        latest = latest_return_by_tag.get(item["tag_id"])
        if latest is None or returned_at > latest:
            latest_return_by_tag[item["tag_id"]] = returned_at

    for tag_id, last_returned_at in latest_return_by_tag.items():
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
            (last_returned_at, tag_id),
        )

    return inserted_rows


def anchor_usage_rows(rows: list[dict]) -> int:
    anchored_count = 0
    for item in rows:
        payload = json.dumps(build_blockchain_record(item), ensure_ascii=False)
        run_besu_script("record-usage-record.mjs", payload)
        anchored_count += 1
    return anchored_count


def main() -> None:
    ensure_prerequisites()

    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            delete_existing_seed_data(cur)
            users = create_dummy_users(cur)
            tags = create_dummy_tags(cur)
            rows = insert_usage_rows(cur, users, tags)
        conn.commit()

    anchored_count = anchor_usage_rows(rows)

    print(
        json.dumps(
            {
                "ok": True,
                "seed_marker": SEED_MARKER,
                "users_created": len(USER_SPECS),
                "tags_created": len(EQUIPMENT_SPECS),
                "usage_rows_created": len(USAGE_PLAN),
                "anchored_count": anchored_count,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

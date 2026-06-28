#!/usr/bin/env python3
from __future__ import annotations

import json
import os

import psycopg


DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/rtls")
SEED_MARKER = "seed_demo_2026_05_19"
USER_PREFIX = "seed_demo_20260519_"
TAG_PREFIX = "seed-demo-20260519-tag-"
SERIAL_PREFIX = "SEED-DEMO-20260519-"
NFC_PREFIX = "seed-demo-20260519-nfc-"


def main() -> None:
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM usage_nfc_events WHERE usage_id IN (SELECT usage_id FROM usage_history WHERE note = %s)",
                (SEED_MARKER,),
            )
            usage_nfc_events_deleted = cur.rowcount

            cur.execute(
                "DELETE FROM usage_history WHERE note = %s",
                (SEED_MARKER,),
            )
            usage_rows_deleted = cur.rowcount

            cur.execute(
                """
                DELETE FROM tags
                WHERE tag_id LIKE %s
                   OR serial_number LIKE %s
                   OR nfc_tag_uid LIKE %s
                """,
                (f"{TAG_PREFIX}%", f"{SERIAL_PREFIX}%", f"{NFC_PREFIX}%"),
            )
            tags_deleted = cur.rowcount

            cur.execute("DELETE FROM users WHERE username LIKE %s", (f"{USER_PREFIX}%",))
            users_deleted = cur.rowcount

        conn.commit()

    print(
        json.dumps(
            {
                "ok": True,
                "seed_marker": SEED_MARKER,
                "usage_nfc_events_deleted": usage_nfc_events_deleted,
                "usage_rows_deleted": usage_rows_deleted,
                "tags_deleted": tags_deleted,
                "users_deleted": users_deleted,
                "note": "온체인에 기록된 원문 레코드는 불변이므로 이 스크립트로 삭제되지 않습니다.",
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

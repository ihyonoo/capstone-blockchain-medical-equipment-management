"""재시드 — 시드 SQL 적용 + staff 비밀번호 채움 + Redis 위치 캐시 정리.

시뮬레이터 런타임과 분리된 별도 진입점이다. 시뮬레이터 프로세스는 DB에 접근하지
않고 실물 리더와 동일하게 HTTP로만 서버와 대화한다.

Redis 정리가 필요한 이유: rtls:tag:* 키에는 TTL이 없어서, 지운 태그의 캐시가 남으면
/rtls/live에 유령 태그가 계속 뜬다.

실행: python -m simulation.apply_seed (저장소 루트에서)
"""

import contextlib

import psycopg
import redis
from passlib.context import CryptContext

from simulation import config
from simulation.generate_seed import PASSWORD_PLACEHOLDER, SEED_SQL_PATH

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

REDIS_LOCATION_KEY_PREFIX = "rtls:tag:"


def apply_seed_sql() -> None:
    sql = SEED_SQL_PATH.read_text(encoding="utf-8")
    with psycopg.connect(config.DATABASE_URL) as conn, conn.cursor() as cur:
        cur.execute(sql)
        conn.commit()


def fill_staff_passwords(password: str) -> int:
    """플레이스홀더 상태인 시뮬 staff 계정에 bcrypt 해시를 채운다.

    같은 비밀번호이므로 해시 하나를 120행이 공유해도 유효하다 — 기동마다 120회
    bcrypt를 도는 낭비를 피한다.
    """
    password_hash = pwd.hash(password)
    with psycopg.connect(config.DATABASE_URL) as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE users SET password_hash = %s "
            "WHERE is_real_hardware = FALSE AND role = 'staff' AND password_hash = %s",
            (password_hash, PASSWORD_PLACEHOLDER),
        )
        updated = cur.rowcount
        conn.commit()
    return updated


def flush_location_cache() -> int:
    client = redis.Redis.from_url(config.REDIS_URL, socket_connect_timeout=1)
    with contextlib.suppress(Exception):
        keys = list(client.scan_iter(match=f"{REDIS_LOCATION_KEY_PREFIX}*"))
        if keys:
            client.delete(*keys)
        return len(keys)
    return 0


def main() -> None:
    if not config.SIM_STAFF_PASSWORD:
        raise SystemExit("SIM_STAFF_PASSWORD 환경변수가 필요합니다 (simulation/.env 참고).")
    apply_seed_sql()
    print("[apply_seed] seed sql applied")
    print(f"[apply_seed] filled {fill_staff_passwords(config.SIM_STAFF_PASSWORD)} staff passwords")
    print(f"[apply_seed] flushed {flush_location_cache()} cached tag locations")


if __name__ == "__main__":
    main()

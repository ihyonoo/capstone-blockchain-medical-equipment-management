"""테스트가 개발용 Redis와 분리되어 있는지 검증한다.

conftest는 DATABASE_URL만 테스트 DB로 덮어썼고 REDIS_URL은 기본값(…/0)을 그대로 써서,
같은 머신에서 개발용 백엔드·시뮬레이터가 돌면 그들이 쓴 rtls:tag:* 캐시를 테스트가 함께
읽었다. conftest가 매 테스트 전에 캐시를 지워도 시뮬레이터가 곧바로 다시 채우기 때문에,
/rtls/live 같은 엔드포인트의 응답에 남의 태그가 섞여 들어온다.
"""

import json

import pytest

from backend.rtls_utils import REDIS_LOCATION_KEY_PREFIX
from backend.settings import REDIS_URL

# 개발용 기본값. 테스트는 여기가 아닌 다른 논리 DB를 써야 한다.
DEV_REDIS_URL = "redis://127.0.0.1:6379/0"

# 개발 데이터와 절대 겹치지 않도록 이 파일 전용 태그 ID를 쓴다.
FOREIGN_TAG_ID = "REDIS-ISOLATION-PROBE-0001"


def _dev_redis_client():
    """개발용 논리 DB(…/0)에 직접 붙는 클라이언트. 없으면 None."""
    try:
        import redis
    except Exception:
        return None
    try:
        client = redis.Redis.from_url(DEV_REDIS_URL, decode_responses=True, socket_connect_timeout=0.3)
        client.ping()
        return client
    except Exception:
        return None


@pytest.fixture
def dev_redis():
    client = _dev_redis_client()
    if client is None:
        pytest.skip("개발용 Redis에 붙을 수 없어 격리를 검증할 수 없다.")
    key = f"{REDIS_LOCATION_KEY_PREFIX}{FOREIGN_TAG_ID}:current"
    yield client, key
    client.delete(key)


class TestRedisIsolation:
    def test_app_does_not_read_the_dev_redis_database(self):
        assert REDIS_URL != DEV_REDIS_URL, (
            "테스트가 개발용 Redis(…/0)를 그대로 쓰고 있다. 같은 머신에서 개발 백엔드나 "
            "시뮬레이터가 돌면 그들이 남긴 태그 캐시가 테스트 응답에 섞인다."
        )

    def test_foreign_cache_entry_never_reaches_the_api(self, client, dev_redis, seed_user):
        """개발용 Redis에 남이 써둔 위치 캐시가 /rtls/live 응답에 새어 들어오면 안 된다."""
        dev_client, key = dev_redis
        dev_client.set(
            key,
            json.dumps({"tag_id": FOREIGN_TAG_ID, "reader_id": "M501", "changed_at": 1_700_000_000}),
        )
        _, headers = seed_user(username="admin_probe", role="admin", position=None)

        body = client.get("/rtls/live", headers=headers).json()

        tag_ids = {item["tag_id"] for item in body["items"]}
        assert FOREIGN_TAG_ID not in tag_ids

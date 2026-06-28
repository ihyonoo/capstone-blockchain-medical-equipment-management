import os
import re
from pathlib import Path

from dotenv import load_dotenv

# 백엔드는 저장소 루트의 .env를 기준으로 읽는다.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:9124@localhost:5432/rtls",
)
REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
BESU_DIR = Path(__file__).resolve().parents[1] / "blockchain" / "besu"
BESU_DEPLOYMENT_PATH = BESU_DIR / "deployments" / "usage-registry.json"
AUTH_TOKEN_SECRET = os.getenv("AUTH_TOKEN_SECRET", "dev-auth-secret")
AUTH_TOKEN_TTL_SEC = max(300, int(os.getenv("AUTH_TOKEN_TTL_SEC", "43200")))
REDIS_LOCATION_KEY_PREFIX = "rtls:tag:"
REDIS_CONNECT_TIMEOUT_SEC = 0.2
REDIS_RETRY_COOLDOWN_SEC = 5
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{2,49}$")

READER_LOCATION = {
    "M503": "수술실",
    "M504": "영상의학과",
}

HYST_DB = 8
DWELL_SEC = 2
STALE_SEC = 5

BLOCKCHAIN_DEMO_BLOCKS_PATH = BESU_DIR / "examples" / "usage-record-batch-5x30-blocks.human.json"
BLOCKCHAIN_DEMO_FAILED_BLOCK_INDEX = 1
BLOCKCHAIN_DEMO_FAILED_TRANSACTION_INDEX = 25

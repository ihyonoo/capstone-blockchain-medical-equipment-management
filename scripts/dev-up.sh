#!/usr/bin/env bash
# 로컬 전면 가동: Colima → 인프라(postgres·redis·besu) → backend → frontend → simulator.
# 멱등: 이미 떠 있는 건 건드리지 않고 넘어간다.
# 로그는 저장소 루트의 backend.log / frontend.log / simulator.log (매 기동마다 새로 씀).
# 정지: bash scripts/dev-down.sh 는 없다 — 앱은 kill, 인프라는 docker-compose -f docker-compose.dev.yml down.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

port_busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

# 1) Docker 런타임(Colima)
if docker info >/dev/null 2>&1; then
  echo "[1/5] docker: 이미 실행 중"
else
  echo "[1/5] docker: colima start"
  colima start
fi

# 2) 인프라 — postgres + redis + besu(검증자 4 + RPC 노드)
echo "[2/5] 인프라: docker-compose -f docker-compose.dev.yml up -d"
docker-compose -f docker-compose.dev.yml up -d

# postgres가 접속을 받을 때까지 대기(최대 30초).
for _ in $(seq 30); do
  docker exec mediledger-postgres-dev pg_isready -U mediledger -q && break
  sleep 1
done

# 3) backend — uvicorn --reload
if port_busy 8000; then
  echo "[3/5] backend: 이미 :8000 사용 중 — 건너뜀"
else
  echo "[3/5] backend: uvicorn :8000"
  nohup "$ROOT/.venv/bin/uvicorn" backend.server:app --reload --host 0.0.0.0 --port 8000 \
    >"$ROOT/backend.log" 2>&1 &
fi

# 4) frontend — vite dev
if port_busy 5173; then
  echo "[4/5] frontend: 이미 :5173 사용 중 — 건너뜀"
else
  echo "[4/5] frontend: vite :5173"
  (cd frontend && nohup npm run dev >"$ROOT/frontend.log" 2>&1 &)
fi

# 5) simulator — 가상 병원 상시 가동
if pgrep -f 'simulation\.simulator' >/dev/null 2>&1; then
  echo "[5/5] simulator: 이미 실행 중 — 건너뜀"
else
  echo "[5/5] simulator: python -m simulation.simulator"
  # -u: 리다이렉트 시 stdout이 버퍼링돼 로그가 비는 걸 막음.
  nohup "$ROOT/.venv/bin/python" -u -m simulation.simulator >"$ROOT/simulator.log" 2>&1 &
fi

echo
echo "backend  http://localhost:8000/docs"
echo "frontend http://localhost:5173"
echo "besu rpc http://127.0.0.1:8549"

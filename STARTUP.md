# 의료 장비 사용 이력 관리 시스템 실행 가이드

재부팅 후 현재와 같은 개발 환경을 다시 올릴 때 사용하는 명령어 모음이다.

## 1. 빠른 실행 순서

아래 4개를 순서대로 실행하면 된다.

### 터미널 1: PostgreSQL 실행
```bash
cd /Users/hyunwoo/Desktop/project/capstone
pg_ctl -D .postgres-data -l .postgres-data/server.log start
```

### 터미널 2: Colima / Docker / Besu 실행
```bash
colima start
cd /Users/hyunwoo/Desktop/project/capstone/blockchain/besu
docker-compose up -d
```

### 터미널 3: 백엔드 실행
```bash
cd /Users/hyunwoo/Desktop/project/capstone
./.venv/bin/uvicorn backend.server:app --host 0.0.0.0 --port 8000
```

### 터미널 4: 프론트 실행
```bash
cd /Users/hyunwoo/Desktop/project/capstone/frontend
npm run dev:lan
```

## 2. 접속 주소

- 프론트: `http://192.168.0.129:5173`
- 백엔드: `http://192.168.0.129:8000`
- Besu RPC: `http://127.0.0.1:8549`

브라우저 탭 제목은 `의료 장비 사용 이력 관리 시스템`으로 표시된다.

## 3. 정상 동작 확인

### PostgreSQL 확인
```bash
psql 'postgresql://localhost:5432/rtls' -c '\dt'
```

### Besu 확인
```bash
curl -s -X POST http://127.0.0.1:8549 \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### 백엔드 확인
```bash
curl -s http://127.0.0.1:8000/rtls/live
curl -s 'http://127.0.0.1:8000/usage/history?limit=1'
```

### 프론트 확인
- 맥북 브라우저: `http://192.168.0.129:5173`
- 스마트폰: 같은 와이파이에서 `http://192.168.0.129:5173`

## 4. 라즈베리파이 전제

맥북만 올린다고 RTLS가 자동으로 들어오는 것은 아니다. 아래 장비들도 켜져 있어야 한다.

- 태그 송출기: `hw_tag@192.168.0.175`
- 리더 1: `hw@192.168.0.19`
- 리더 2: `hw_reader2@192.168.0.17`

리더 스크립트 쪽 `RTLS_SERVER_URL`은 다음을 사용해야 한다.

```env
RTLS_SERVER_URL=http://192.168.0.129:8000/ingest
```

리더기에서 실행 예:

```bash
python send_to_server.py
```

## 5. 종료 명령

### 프론트 / 백엔드
- 실행 중인 터미널에서 `Ctrl+C`

### Besu
```bash
cd /Users/hyunwoo/Desktop/project/capstone/blockchain/besu
docker-compose down
```

### PostgreSQL
```bash
cd /Users/hyunwoo/Desktop/project/capstone
pg_ctl -D .postgres-data stop
```

### Colima
```bash
colima stop
```

## 6. 참고

- 백엔드가 바뀌었는데 관리자 검증 화면이 이상하면, 대부분 백엔드를 재시작하면 해결된다.
- 스마트폰 NFC URL은 현재 LAN 주소 기준이다.
  - 예: `http://192.168.0.129:5173/nfc/<token>`
- 맥북 IP가 바뀌면 `frontend/.env`, 태그 URL, 라즈베리파이 `RTLS_SERVER_URL`도 같이 바꿔야 한다.

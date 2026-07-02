# 블록체인을 활용한 의료 장비 사용 이력 관리 시스템

의료 장비의 실시간 위치, NFC 기반 사용 시작/반납, 사용 이력 조회, 온체인 무결성 검증을 하나의 웹 애플리케이션으로 묶은 캡스톤 프로젝트입니다.

프론트엔드는 의료 현장 운영자가 장비 상태를 빠르게 확인할 수 있는 React 기반 대시보드이고, 백엔드는 FastAPI로 인증, RTLS 수집, NFC 사용 이력, 블록체인 앵커링을 처리합니다. 사용 완료 이력은 Hyperledger Besu 프라이빗 네트워크의 Solidity 컨트랙트에 기록되며, 이후 DB 원문과 온체인 원문 및 블록 트랜잭션 루트를 비교해 무결성을 검증합니다.

## 주요 기능

- 관리자/직원 회원가입 및 로그인
- 권한별 화면 접근 제어
- RTLS 리더가 수집한 iBeacon RSSI 기반 장비 위치 추정
- 장비 목록과 리더 위치 패널을 통한 실시간 위치 조회
- 관리자용 NFC 토큰 매핑 관리
- NFC 태그 URL을 통한 장비 조회, 사용 시작, 반납 처리
- 사용 완료 이력의 온체인 자동 기록
- 사용 이력 검색, 정렬, 기간 필터링
- DB 원문, 온체인 원문, 트랜잭션 입력값, 블록 `transactionsRoot` 기반 무결성 검증
- 라이트/다크 모드 토글

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | React, Vite, TypeScript, React Router, Tailwind CSS, Radix UI 계열 컴포넌트, lucide-react |
| Backend | Python, FastAPI, Pydantic, psycopg 3, passlib/bcrypt, python-dotenv |
| Database | PostgreSQL |
| Cache | Redis, RTLS 최신 위치 캐시 |
| Blockchain | Hyperledger Besu QBFT, Solidity, ethers.js, solc |
| RTLS | BLE iBeacon, bleak, requests |
| Dev Infra | Docker Compose, npm, Python venv |

## 전체 구조

```text
capstone/
├── backend/                    # FastAPI 서버, 인증, RTLS/NFC/사용 이력/검증 로직
├── blockchain/besu/            # Besu QBFT 네트워크, Solidity 컨트랙트, 온체인 스크립트
├── database/schema.sql         # PostgreSQL 스키마 및 인덱스
├── frontend/                   # Vite React 웹 애플리케이션
├── rtls/                       # BLE 리더/태그 데모 스크립트
├── scripts/                    # DB 초기화, 데모 데이터 생성/정리 스크립트
├── .env.example                # 백엔드/루트 환경 변수 예시
└── README.md
```

## 시스템 아키텍처

```mermaid
flowchart LR
  Tag[iBeacon 태그] --> Reader[RTLS 리더]
  Reader -->|POST /ingest| API[FastAPI Backend]
  NFC[NFC 태그 URL] --> Web[React Frontend]
  Web -->|Bearer Token API| API
  API --> DB[(PostgreSQL)]
  API --> Redis[(Redis)]
  API -->|node scripts/*.mjs| Besu[Hyperledger Besu QBFT]
  Besu --> Contract[UsageRecordRegistry]
  Contract --> Besu
  API --> Web
```

### 데이터 흐름 요약

1. RTLS 리더가 BLE 광고 패킷을 스캔하고 RSSI 중앙값을 백엔드 `/ingest`로 전송합니다.
2. 백엔드는 리더별 RSSI를 비교해 가장 유력한 위치를 결정하고, 위치 이력을 PostgreSQL에 저장하며 최신 위치는 Redis에 캐시합니다.
3. 사용자가 NFC 태그 URL을 열면 프론트엔드가 `/nfc/{token}`으로 장비 정보를 조회합니다.
4. 사용 시작 시 `usage_history`에 `checked_out` 이력이 생성되고 `tags.asset_status`가 `checked_out`으로 변경됩니다.
5. 반납 시 사용 이력이 `returned`로 변경되고 백엔드가 `UsageRecordRegistry` 컨트랙트에 최소 원문 레코드를 기록합니다.
6. 사용 이력 검증 화면은 DB 원문, 온체인 원문, 앵커 트랜잭션 입력값, 블록 머클 루트를 비교해 성공/실패 상태를 보여줍니다.

## 실행 전 준비 사항

아래 도구가 필요합니다.

- Node.js 20 이상 권장
- npm
- Python 3.11 이상 권장
- PostgreSQL
- Docker 및 Docker Compose
- `psql`
- `openssl`
- BLE RTLS를 실제 장비로 테스트할 경우 Bluetooth 어댑터와 Linux BLE 도구

## 환경 변수

루트 환경 변수는 저장소 루트의 `.env`에서 읽습니다.

```bash
cp .env.example .env
```

주요 값:

| 변수 | 기본/예시 | 설명 |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://localhost:5432/rtls` | 백엔드와 스크립트가 사용할 PostgreSQL 연결 문자열 |
| `CORS_ALLOW_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | 허용할 프론트엔드 Origin |
| `REDIS_URL` | `redis://127.0.0.1:6379/0` | RTLS 최신 위치 캐시용 Redis |
| `AUTH_TOKEN_SECRET` | `change-me-for-shared-dev` | HMAC 기반 인증 토큰 서명 키 |
| `AUTH_TOKEN_TTL_SEC` | `43200` | 로그인 토큰 유효 시간 |

프론트엔드 환경 변수:

```bash
cp frontend/.env.example frontend/.env
```

| 변수 | 기본/예시 | 설명 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:8000` | 프론트엔드가 호출할 백엔드 주소 |

RTLS 리더 환경 변수:

```bash
cp rtls/.env.example rtls/.env
```

| 변수 | 기본/예시 | 설명 |
| --- | --- | --- |
| `RTLS_SERVER_URL` | `http://127.0.0.1:8000/ingest` | 리더가 관측값을 전송할 백엔드 엔드포인트 |
| `RTLS_READER_ID` | `M501` | 해당 리더의 논리 ID |

Besu 네트워크 환경 변수는 `blockchain/besu/scripts/generate-network.sh` 실행 후 `blockchain/besu/.env`에 생성됩니다.

## 빠른 실행 순서

### 1. Python 백엔드 의존성 설치

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 2. 프론트엔드 의존성 설치

```bash
cd frontend
npm install
cd ..
```

### 3. 블록체인 도구 의존성 설치

```bash
cd blockchain/besu
npm install
cd ../..
```

### 4. PostgreSQL 준비

이 저장소에는 PostgreSQL용 Docker Compose 파일이 따로 포함되어 있지 않습니다. 로컬 PostgreSQL을 사용하거나 별도 컨테이너를 실행해 `rtls` 데이터베이스를 준비합니다.

예시:

```bash
createdb rtls
```

또는 Docker로 PostgreSQL을 띄우는 예시:

```bash
docker run --name capstone-postgres \
  -e POSTGRES_PASSWORD=9124 \
  -e POSTGRES_DB=rtls \
  -p 5432:5432 \
  -d postgres:16
```

Docker 예시를 사용할 경우 루트 `.env`의 `DATABASE_URL`을 다음처럼 맞춥니다.

```env
DATABASE_URL=postgresql://postgres:9124@localhost:5432/rtls
```

스키마 적용:

```bash
bash scripts/init-db.sh
```

### 5. Besu QBFT 네트워크 및 Redis 실행

`blockchain/besu/docker-compose.yml`에는 Redis와 Besu 노드들이 포함되어 있습니다.

```bash
bash blockchain/besu/scripts/generate-network.sh
cd blockchain/besu
docker compose up -d
cd ../..
```

네트워크 확인:

```bash
bash blockchain/besu/scripts/check-network.sh
```

기본 RPC 엔드포인트는 `http://127.0.0.1:8549`입니다. 일부 개발 확인 명령에서는 validator1의 `http://127.0.0.1:8545`도 사용할 수 있습니다.

### 6. UsageRecordRegistry 컨트랙트 배포

```bash
cd blockchain/besu
npm run deploy:usage-registry
cd ../..
```

배포 결과는 `blockchain/besu/deployments/usage-registry.json`에 저장됩니다. 백엔드는 이 파일이 있어야 반납 완료 이력을 온체인에 기록하고 검증할 수 있습니다.

### 7. 백엔드 실행

```bash
source .venv/bin/activate
python -m uvicorn backend.server:app --host 127.0.0.1 --port 8000
```

API 문서:

- `http://127.0.0.1:8000/docs`

### 8. 프론트엔드 실행

```bash
cd frontend
npm run dev
```

웹 앱:

- `http://127.0.0.1:5173/`

LAN 장치에서 접속해야 하는 경우:

```bash
cd frontend
npm run dev:lan
```

## 웹 화면

| 경로 | 화면 | 권한 | 설명 |
| --- | --- | --- | --- |
| `/` | 로그인 | 전체 | 관리자/직원 역할을 선택해 로그인 |
| `/signup` | 회원가입 | 전체 | 관리자 또는 직원 계정 생성 |
| `/equipment` | 의료 장비 위치 검색 | 관리자, 직원 | RTLS 최신 위치, 장비 목록, 리더 위치 패널 확인 |
| `/verification` | 장비 사용 이력 검색/검증 | 관리자 | 사용 이력 조회 및 온체인 무결성 검증 |
| `/admin/nfc-mapping` | NFC 매핑 관리 | 관리자 | 장비와 NFC 토큰 연결/해제 |
| `/nfc/:token` | NFC 장비 사용 | 관리자, 직원 | 장비 조회, 사용 시작, 반납 |

인증 정보는 브라우저 `sessionStorage`에 저장됩니다. 다크모드 선택은 `localStorage`의 `mediledger-color-mode`에 저장됩니다.

## 권한 모델

| 역할 | 가능한 작업 |
| --- | --- |
| `admin` | 모든 화면 접근, NFC 매핑 관리, 모든 장비 반납 처리, 사용 이력/검증 조회 |
| `staff` | 장비 위치 조회, NFC 장비 조회, 본인이 대여한 장비 반납 |

회원가입 제약:

- `username`: 3~50자의 영문, 숫자, `.`, `_`, `-`
- `password`: 8~128자
- `role`: `admin` 또는 `staff`
- `staff` 계정은 `position`이 필수입니다.

## 주요 API

### 인증

| Method | Endpoint | 설명 |
| --- | --- | --- |
| `POST` | `/auth/register` | 사용자 등록 |
| `POST` | `/auth/login` | 로그인 및 Bearer 토큰 발급 |

### RTLS 위치

| Method | Endpoint | 권한 | 설명 |
| --- | --- | --- | --- |
| `POST` | `/ingest` | 없음 | RTLS 리더 관측값 수신 |
| `GET` | `/where/{tag_id}` | 관리자, 직원 | 특정 장비의 최신 위치 조회 |
| `GET` | `/rtls/live` | 관리자, 직원 | 전체 장비 최신 위치와 리더 위치 목록 조회 |

`POST /ingest` 요청 예시:

```json
{
  "reader_id": "M501",
  "ts": 1779294600,
  "observations": [
    {
      "tag_id": "fda50693-a4e2-4fb1-afcf-c6eb07647825:1:1",
      "rssi": -61,
      "count": 5,
      "last_seen": 1779294599
    }
  ]
}
```

### NFC 및 사용 이력

| Method | Endpoint | 권한 | 설명 |
| --- | --- | --- | --- |
| `GET` | `/admin/nfc-mappings` | 관리자 | 활성 장비의 NFC 매핑 목록 |
| `POST` | `/admin/nfc-mappings` | 관리자 | 장비에 NFC 토큰 매핑 |
| `DELETE` | `/admin/nfc-mappings/{tag_id}` | 관리자 | 장비의 NFC 토큰 해제 |
| `GET` | `/nfc/{token}` | 관리자, 직원 | NFC 토큰으로 장비 조회 |
| `POST` | `/usage/checkout` | 관리자, 직원 | 장비 사용 시작 |
| `POST` | `/usage/return` | 관리자, 직원 | 장비 반납 및 온체인 기록 |
| `GET` | `/usage/history` | 관리자 | 사용 이력 검색 |
| `GET` | `/usage/history/blockchain-demo` | 관리자 | 블록체인 검증 데모 데이터 조회 |

NFC 사용 시작/반납 요청 예시:

```json
{
  "nfc_token": "04:A1:B2:C3:D4:E5"
}
```

사용 이력 검색 쿼리:

| Query | 설명 |
| --- | --- |
| `user` | 사용자 이름 또는 사용자 ID 검색 |
| `equipment` | 장비명 또는 태그 ID 검색 |
| `checkout_location` | 사용 시작 위치 |
| `return_location` | 반납 위치 |
| `date` | 단일 날짜, `YYYY-MM-DD` |
| `start_date` | 조회 시작일 |
| `end_date` | 조회 종료일 |
| `sort_by` | `time`, `user`, `equipment` |
| `sort_order` | `asc`, `desc` |
| `limit` | 조회 개수 |
| `include_blockchain` | `true`이면 온체인 검증 포함 |

## 데이터베이스 모델

| 테이블 | 역할 |
| --- | --- |
| `users` | 관리자/직원 계정, 부서, 직책, 비밀번호 해시 |
| `readers` | RTLS 리더 ID와 실제 위치명 |
| `tags` | 의료 장비 메타데이터, NFC 토큰, 대여 상태, 현재 사용자 |
| `tag_state_history` | RTLS 위치 판정 이력 |
| `usage_history` | 장비 사용 시작/반납 이력과 블록체인 앵커 메타데이터 |
| `usage_nfc_events` | NFC 액션 이벤트 로그 |

중요 제약:

- 사용 중인 장비는 `tags.asset_status = 'checked_out'`이고 `current_holder_user_id`, `current_usage_id`, `last_checkout_at`이 있어야 합니다.
- 반납 완료 이력은 `usage_history.usage_status = 'returned'`, `returned_at`, `return_method`가 있어야 합니다.
- 장비별 열린 사용 이력은 하나만 존재하도록 `idx_usage_history_open_usage_per_tag` 유니크 인덱스를 둡니다.
- NFC 토큰은 유니크 인덱스로 중복 매핑을 막습니다.

## RTLS 동작 방식

RTLS 리더 스크립트는 BLE iBeacon 패킷을 수집합니다.

```bash
cd rtls
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python rtls_reader/send_to_server.py
```

동작 요약:

- iBeacon 제조사 데이터에서 UUID, major, minor를 읽습니다.
- 태그 ID 형식은 `{uuid}:{major}:{minor}`입니다.
- 최근 2초 윈도우의 RSSI 중앙값을 계산합니다.
- 1초마다 `/ingest`로 리더 ID와 관측값을 전송합니다.
- 백엔드는 RSSI 차이가 `HYST_DB` 이상이고 `DWELL_SEC` 이상 유지될 때 위치 변경으로 확정합니다.
- 확정된 위치는 `tag_state_history`에 저장되고 Redis 최신 위치 캐시에 반영됩니다.

기본 RTLS 파라미터는 `backend/settings.py`에 있습니다.

| 값 | 기본값 | 의미 |
| --- | --- | --- |
| `HYST_DB` | `8` | 리더 전환을 인정하기 위한 RSSI 차이 |
| `DWELL_SEC` | `2` | 후보 리더가 유지되어야 하는 시간 |
| `STALE_SEC` | `5` | 관측값 신선도 판단 기준 |

데모용 iBeacon 송신 스크립트:

```bash
cd rtls
python rtls_tag/ibeacon_broadcast.py
```

이 스크립트는 Linux Bluetooth HCI 명령을 직접 사용하므로 `sudo`, `hciconfig`, `hcitool`이 필요합니다.

## 블록체인 구성

`blockchain/besu`는 개발용 Hyperledger Besu QBFT 네트워크를 포함합니다.

구성:

- validator 4대
- non-validator RPC 노드 1대
- Redis 1대
- Chain ID: `1337`
- RPC 기본값: `http://127.0.0.1:8549`
- 컨트랙트: `UsageRecordRegistry`

주요 포트:

| 서비스 | RPC | P2P |
| --- | --- | --- |
| `validator1` | `8545` | `30303` |
| `validator2` | `8546` | `30304` |
| `validator3` | `8547` | `30305` |
| `validator4` | `8548` | `30306` |
| `rpc-node` | `8549` | `30307` |
| `redis` | `6379` | - |

### 컨트랙트에 저장되는 원문

`UsageRecordRegistry`는 사용 완료 이력의 검증에 필요한 최소 원문만 저장합니다.

| 필드 | 설명 |
| --- | --- |
| `usageId` | DB 사용 이력 ID |
| `checkoutUserId` | 사용 시작 사용자 ID |
| `returnUserId` | 반납 사용자 ID |
| `tagId` | 장비 태그 ID |
| `checkoutLocation` | 사용 시작 위치 |
| `checkoutAt` | 사용 시작 시각, epoch seconds |
| `returnLocation` | 반납 위치 |
| `returnedAt` | 반납 시각, epoch seconds |
| `recordedAt` | 온체인 기록 시각 |
| `recorder` | 기록 트랜잭션 발신자 |

동일한 `usageId`는 한 번만 기록할 수 있습니다.

### 블록체인 스크립트

`blockchain/besu/package.json`에 등록된 주요 스크립트:

```bash
cd blockchain/besu
npm run deploy:usage-registry
npm run record:usage-record -- '{"usageId":"1","checkoutUserId":1,"returnUserId":2,"tagId":"EQ-1","checkoutLocation":"수술실","checkoutAt":1779294600,"returnLocation":"영상의학과","returnedAt":1779298200}'
npm run read:usage-record -- 1
```

추가 스크립트:

| 파일 | 역할 |
| --- | --- |
| `scripts/generate-network.sh` | Besu QBFT genesis, validator key, bootnode 설정 생성 |
| `scripts/check-network.sh` | RPC 블록 번호 확인 |
| `scripts/verify-usage-records.mjs` | DB 요청 묶음을 받아 온체인 원문/트랜잭션/머클 루트 검증 |
| `scripts/send-usage-record-batch.mjs` | 데모용 사용 이력 배치 전송 |
| `scripts/send-usage-record-multiblock.mjs` | 여러 블록에 걸친 데모 레코드 전송 |
| `scripts/export-multiblock-artifacts.mjs` | 블록/트랜잭션 검증용 산출물 내보내기 |
| `scripts/humanize-block-json.mjs` | 블록 JSON을 사람이 읽기 쉬운 형태로 변환 |
| `scripts/humanize-multiblock-json.mjs` | 여러 블록 JSON을 사람이 읽기 쉬운 형태로 변환 |

## 무결성 검증 기준

사용 이력 검증은 `GET /usage/history?include_blockchain=true`에서 수행됩니다.

검증 단계:

1. DB의 `usage_history`에서 반납 완료 이력을 조회합니다.
2. 검증 대상 원문을 `usageId`, 사용자 ID, 장비 ID, 위치, 시각 필드로 정규화합니다.
3. 컨트랙트의 `getUsageRecord(usageId)` 결과와 DB 원문을 비교합니다.
4. 저장된 앵커 트랜잭션 해시, 블록 번호, 트랜잭션 인덱스를 기준으로 실제 블록과 트랜잭션을 조회합니다.
5. 트랜잭션 입력값이 DB 원문과 일치하는지 확인합니다.
6. 블록의 트랜잭션 목록에서 `transactionsRoot`를 재계산해 헤더 값과 비교합니다.

주요 상태:

| 상태 | 의미 |
| --- | --- |
| `verified` | DB 원문, 온체인 원문, 트랜잭션 입력값, 블록 머클 루트가 모두 일치 |
| `not_eligible` | 아직 반납 완료되지 않아 검증 제외 |
| `not_configured` | 컨트랙트 배포 파일 또는 Besu 의존성이 없어 검증 환경 미준비 |
| `onchain_missing` | DB에는 반납 이력이 있으나 온체인 원문이 없음 |
| `db_mismatch` | DB 원문과 온체인 원문이 다름 |
| `tx_input_mismatch` | 앵커 트랜잭션 입력값이 DB 원문과 다름 |
| `anchor_unresolved` | 검증할 앵커 트랜잭션 메타데이터가 없음 |
| `transaction_missing` | 블록체인에서 트랜잭션 또는 영수증 조회 실패 |
| `tx_not_in_block` | 저장된 트랜잭션이 지정된 블록/인덱스와 불일치 |
| `transactions_root_mismatch` | 블록 `transactionsRoot` 재계산 결과 불일치 |
| `chain_error` | 검증 스크립트 실행 또는 응답 처리 오류 |

## 데모 데이터

데모 사용 이력을 생성하려면 PostgreSQL 스키마, Besu 네트워크, 컨트랙트 배포, `blockchain/besu/node_modules`가 준비되어 있어야 합니다.

```bash
source .venv/bin/activate
python scripts/seed_dummy_usage_history.py
```

정리:

```bash
source .venv/bin/activate
python scripts/cleanup_dummy_usage_history.py
```

주의:

- 정리 스크립트는 DB의 데모 사용자, 장비, 사용 이력만 삭제합니다.
- 이미 온체인에 기록된 레코드는 블록체인 특성상 삭제되지 않습니다.

## 개발 명령어 모음

루트:

```bash
bash scripts/init-db.sh
python scripts/seed_dummy_usage_history.py
python scripts/cleanup_dummy_usage_history.py
```

백엔드:

```bash
source .venv/bin/activate
python -m uvicorn backend.server:app --host 127.0.0.1 --port 8000
```

프론트엔드:

```bash
cd frontend
npm run dev
npm run dev:lan
npm run build
```

블록체인:

```bash
bash blockchain/besu/scripts/generate-network.sh
cd blockchain/besu
docker compose up -d
npm run deploy:usage-registry
npm run read:usage-record -- 1
docker compose down
```

상태 확인:

```bash
curl -I http://127.0.0.1:5173/
curl -I http://127.0.0.1:8000/docs
pg_isready -h 127.0.0.1 -p 5432
curl -sS -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","method":"web3_clientVersion","params":[],"id":1}' \
  http://127.0.0.1:8549
```

## 운영 및 보안 주의 사항

이 프로젝트는 개발/시연용 구성을 기준으로 합니다.

- 기본 Besu 개인키는 개발용 prefunded 계정입니다. 운영 환경에 그대로 사용하면 안 됩니다.
- `AUTH_TOKEN_SECRET`은 운영/공유 환경에서 반드시 강한 값으로 변경해야 합니다.
- 인증 토큰은 자체 HMAC 포맷이며, 운영 수준의 세션 관리/리프레시 토큰/감사 로그 체계는 별도로 설계해야 합니다.
- Besu 네트워크는 단일 호스트 개발용입니다. TLS, permissioning, Web3Signer, 키 관리, 방화벽 정책은 포함되어 있지 않습니다.
- `/ingest`는 현재 인증 없이 RTLS 리더 입력을 받습니다. 운영에서는 리더 인증 또는 네트워크 격리가 필요합니다.
- RTLS 위치 추정은 RSSI 기반이므로 실제 병원 환경에서는 전파 간섭, 벽체, 인체 차폐, 리더 배치에 따른 보정이 필요합니다.
- Redis는 최신 위치 캐시 용도이며, Redis 장애 시 DB의 최신 위치 이력으로 일부 복구됩니다.

## 문제 해결

### 프론트엔드에서 API 호출이 실패할 때

- 백엔드가 `127.0.0.1:8000`에서 실행 중인지 확인합니다.
- `frontend/.env`의 `VITE_API_BASE_URL`이 실제 백엔드 주소와 맞는지 확인합니다.
- LAN 장치에서 접속하는 경우 백엔드 CORS와 프론트엔드 `dev:lan` 실행 여부를 확인합니다.

### 로그인은 되지만 화면 접근이 막힐 때

- 로그인 시 선택한 역할과 DB 계정의 `role`이 같은지 확인합니다.
- `staff`는 관리자 화면인 `/verification`, `/admin/nfc-mapping`에 접근할 수 없습니다.
- 토큰이 만료되면 프론트엔드가 세션을 정리하므로 다시 로그인해야 합니다.

### 반납 후 온체인 기록이 실패할 때

- `blockchain/besu/deployments/usage-registry.json`이 존재하는지 확인합니다.
- `blockchain/besu/node_modules`가 설치되어 있는지 확인합니다.
- Besu RPC가 살아 있는지 확인합니다.
- 백엔드가 실행되는 환경에서 `node` 명령을 사용할 수 있어야 합니다.

### 사용 이력 검증이 `체인 미설정`으로 표시될 때

다음 순서를 확인합니다.

```bash
cd blockchain/besu
npm install
npm run deploy:usage-registry
```

그리고 Besu 네트워크가 실행 중인지 확인합니다.

```bash
bash blockchain/besu/scripts/check-network.sh
```

### RTLS 위치가 갱신되지 않을 때

- `rtls/.env`의 `RTLS_SERVER_URL`이 백엔드 `/ingest`를 가리키는지 확인합니다.
- `RTLS_READER_ID`가 DB의 리더 ID 또는 백엔드 `READER_LOCATION` 매핑과 맞는지 확인합니다.
- 태그 ID가 `tags.tag_id`에 등록되어 있어야 DB 위치 이력으로 저장됩니다.
- Redis가 꺼져 있어도 DB 저장은 가능하지만 최신 캐시 조회가 늦어질 수 있습니다.

## 현재 한계

- PostgreSQL 실행 구성은 저장소에 포함되어 있지 않아 로컬 설치 또는 별도 컨테이너가 필요합니다.
- RTLS 위치 판정의 일부 상태는 백엔드 프로세스 메모리에 유지되므로 서버 재시작 시 관측 후보 상태가 초기화됩니다.
- 온체인 기록은 반납 성공 후 백엔드가 Node.js 스크립트를 subprocess로 실행하는 방식입니다.
- 컨트랙트는 사용 이력 원문 저장과 조회에 집중하며, 접근 제어는 개발용 계정 기반입니다.
- 자동 테스트 스크립트는 현재 별도로 정의되어 있지 않고, 프론트엔드는 `npm run build`로 빌드 검증합니다.

# MediLedger & EquipTrace

- IoT 기술을 활용한 실내 의료 장비 실시간 위치 추적 및

- 블록체인을 활용한 의료 장비 사용 이력 무결성 검증 시스템

의료 장비에 BLE iBeacon Tag를 부착하고, BLE 리더가 신호 세기를 보고하면 백엔드가 각 장비의 현재 위치를 산출한다.

의료진은 시스템을 통해 실시간으로 장비의 위치를 확인할 수 있다.

사용하고자 하는 의료 장비에 의료진이 자신의 스마트폰으로 NFC 태깅을 하면 대여 및 반납 처리가 이루어진다.

의료 장비 사용 이력은 **프라이빗 Hyperledger Besu 블록체인에 앵커링**되어 이후 위·변조 여부를 검증할 수 있다.

의료 장비 사용 이력의 구성: {장비 사용자, 사용 장비, 사용 시간, 반납 시간, 사용 위치}

---

## 목차

- [주요 기능](#주요-기능)
- [시스템 아키텍처](#시스템-아키텍처)
- [기술 스택](#기술-스택)
- [디렉토리 구조](#디렉토리-구조)
- [빠른 시작](#빠른-시작)
- [핵심 동작 원리](#핵심-동작-원리)
- [블록체인 무결성 검증](#블록체인-무결성-검증)
- [현재 구성의 한계와 분산의 중요성](#현재-구성의-한계와-분산의-중요성)
- [설계 문서](#설계-문서)

---

## 주요 기능

- **실시간 위치 추적**: RTLS 리더가 보고한 RSSI로 장비의 현재 위치를 산출하고, 의료진 화면에 실시간(1초 폴링) 반영
- **사용 이력 관리**: NFC 토큰 스캔으로 장비 대여(checkout)/반납(return)을 기록
- **블록체인 앵커링**: 반납 완료 시 사용 기록을 Besu 체인에 기록하여 불변성 확보
- **무결성 검증(관리자)**: 저장된 사용 기록을 온체인 값과 대조하여 위·변조 여부를 확인 (온체인 원문 일치 / 머클루트 일치)
- **역할 기반 접근**: 관리자(admin) / 의료진(staff) 권한 분리

---

## 시스템 아키텍처

네 개의 협력 구성요소로 이루어진다.

```
┌─────────────┐   RSSI 배치     ┌──────────────────────────┐
│ RTLS 리더    │ ──POST /ingest─▶│  backend (FastAPI)       │
│ (BLE 스캔)   │                 │                          │
└─────────────┘                 │  ├─ 위치 산출/캐시        │
                                │  ├─ 사용 이력 기록        │──▶ PostgreSQL (원본)
┌─────────────┐  GET /rtls/live │  └─ 온체인 앵커링/검증    │──▶ Redis (위치 캐시)
│ frontend    │ ◀──응답 JSON────│                          │──▶ Besu (무결성)
│ (React SPA) │  GET /usage/... │                          │
└─────────────┘                 └──────────┬───────────────┘
                                           │ subprocess (Node 스크립트)
                                           ▼
                              ┌──────────────────────────────┐
                              │ Hyperledger Besu (QBFT)       │
                              │ 검증자 4 + RPC 노드 1          │
                              │ UsageRecordRegistry.sol       │
                              └──────────────────────────────┘
```

- **`backend/`** — FastAPI + PostgreSQL API (Python). 시스템의 핵심
- **`frontend/`** — React 18 + Vite + TailwindCSS SPA
- **`rtls/`** — BLE 태그 브로드캐스터 및 리더 엣지 스크립트 (Python)
- **`blockchain/besu/`** — 프라이빗 Besu QBFT 네트워크 + Solidity `UsageRecordRegistry` 컨트랙트 + 백엔드가 호출하는 Node.js 스크립트

## 기술 스택

| 영역 | 스택 |
|------|------|
| 백엔드 | Python, FastAPI, psycopg 3 (ORM 미사용) |
| DB | PostgreSQL |
| 캐시 | Redis (위치 캐시, best-effort) |
| 프론트엔드 | React 18, Vite, TailwindCSS v4, react-router v7 |
| 블록체인 | Hyperledger Besu (QBFT), Solidity, Node.js (ethers) |
| 엣지 | Python, bleak (BLE) |

---

## 디렉토리 구조

```
capstone/
├── backend/            FastAPI 앱 + 로직 모듈 (server.py, *_utils.py, settings.py …)
├── frontend/           React SPA (src/app/pages, components …)
├── rtls/               BLE 태그/리더 엣지 스크립트
├── blockchain/besu/    Besu 네트워크, 컨트랙트, Node 스크립트
├── database/           schema.sql (스키마 원본)
```

---

## 빠른 시작

### 1) 데이터베이스 (로컬 PostgreSQL)

```bash
# .env 준비 (.env.example 참고)
# DATABASE_URL=postgresql://localhost:5432/mediledger_db

createdb mediledger_db
psql "$DATABASE_URL" -f database/schema.sql   # 멱등: 재실행 가능
```

> DB는 로컬 PostgreSQL로 운영한다. (Docker는 Besu·Redis 전용)

### 2) 백엔드 (저장소 루트에서 실행)

```bash
pip install -r backend/requirements.txt
uvicorn backend.server:app --host 0.0.0.0 --port 8000
```

### 3) 프론트엔드 (`frontend/`)

```bash
npm install
npm run dev            # Vite dev 서버 :5173
npm run build          # 변경 후 검증
```

### 4) 블록체인 (`blockchain/besu/`)

```bash
bash scripts/generate-network.sh    # 최초 1회: genesis, 검증자 키, .env 생성
docker compose up -d                # 검증자 4 + RPC 노드 1 (+ Redis)
npm install
node scripts/deploy-usage-registry.mjs   # 컨트랙트 배포
```

RPC 엔드포인트: `http://127.0.0.1:8549` (chain ID 1337, QBFT). 블록체인이 준비되지 않으면 백엔드는 앵커링·검증을 **우아하게 건너뛰고** 나머지 기능은 정상 동작한다.

### 5) RTLS 엣지 스크립트 (`rtls/`, BLE 하드웨어 필요)

```bash
pip install -r requirements.txt
python rtls_tag/ibeacon_broadcast.py   # Tag: iBeacon UUID Broadcast
python rtls_reader/send_to_server.py   # Reader: RSSI 스캔 후 /ingest 로 POST
```

---

## 핵심 동작 원리

<img src="docs/figure/scenario.png" alt="전체 사용 시나리오" width="50%">

### 위치 산출 파이프라인

1. 리더가 태그별 RSSI를 2초 창으로 모아 `POST /ingest` 로 배치 전송
2. 백엔드가 가장 센 신호의 리더로 태그 위치를 판정 (히스테리시스·dwell·staleness 임계값으로 흔들림 방지)
3. 결과를 **PostgreSQL(원본)에 먼저 저장 → Redis(캐시)에 갱신** (write-through)
4. 의료진 화면은 `GET /rtls/live` 를 **1초 폴링**하여 Redis+DB 병합 결과를 렌더 (Redis 장애 시 DB 폴백)

### 사용 이력 라이프사이클 + 앵커링

1. NFC 토큰 스캔 → `POST /usage/checkout` / `POST /usage/return` 으로 `usage_history` 행을 열고 닫음
2. 반납 시 완료 기록을 온체인에 앵커링. 백엔드는 라이브러리 대신 **`subprocess`로 `blockchain/besu/scripts/`의 Node 스크립트를 호출**한다 (`record-usage-record.mjs` 등)
3. 이름·부서 등 표시용 필드는 앵커링에서 **의도적으로 제외**, 최소 사실 기록만 온체인에 저장

<img src="docs/figure/sequence.png" alt="시퀀스 다이어그램" width="50%">

---

## 블록체인 무결성 검증

관리자가 이력 화면(`GET /usage/history?include_blockchain=true`)에 진입하면:

1. `usage_history` 를 DB에서 조회
2. 각 기록을 **체인에서 다시 읽어** 현재 DB 값과 대조 (`verify-usage-records.mjs`)
   - **온체인 원문 일치** (`tx_input_matches_db`)
   - **머클루트 일치** (`transactions_root_matches`)
3. 위·변조가 있으면 재계산 해시가 온체인 값과 **불일치**로 드러남

누군가 DB를 몰래 고쳐도, 온체인에 박힌 불변 값과 대조되어 **감지**된다.

---

## 현재 구성의 한계와 분산의 중요성

### 현재(개발) 구성의 한계

지금은 검증자 4개 + RPC 노드가 **모두 개발용 노트북 한 대의 Docker 컨테이너**로 실행된다. 이 때문에:

- **노트북을 끄면 체인이 멈춘다.** 모든 노드가 한 대에 있으므로 네트워크 전체가 정지한다. (단, 데이터는 볼륨에 보존되어 재시작 시 이어서 재개된다 — 정지이지 초기화는 아님)
- **각 컨테이너의 데이터 폴더를 전부 지우면 체인이 초기화된다.** 모든 노드의 사본을 동시에 삭제할 수 있기 때문에 이력이 사라진다. (일부 노드만 지우면 나머지에서 재동기화되어 복구된다)

즉 **모든 노드를 한 주체가 한 장소에서 통제하면, 물리적으로만 여러 노드일 뿐 진정한 분산이 아니다.** 단일 장애점(SPOF)이자, 마음먹으면 조작도 가능하다. → **그래서 각 기관에 노드를 분산하는 것이 결정적으로 중요하다.**

### 진짜 의미 있는 구성 = 컨소시엄

블록체인의 가치는 **"서로 믿지 않아도 되는(trustless)"** 데서 나온다. 이는 검증자를 **서로 독립적인 여러 주체**가 나누어 운영할 때 비로소 성립한다. 의료 장비 이력 추적에서는 다음과 같은 컨소시엄이 적합하다.

| 참여 주체 | 역할 |
|-----------|------|
| 🏥 **참여 병원들** | 각 병원이 검증자 1개씩 운영 |
| 🏛️ **규제/공공기관** | 보건복지부·식약처 등 감독기관 |
| 🔍 **감사/보험사** | 제3자 검증 주체 |
| 🏭 **장비 제조사** | 이력 추적 이해관계자 |
| 🎓 **인증기관** | 무결성 보증 주체 |

이렇게 구성되면 **어느 한 병원이 사용 기록을 조작하려 해도 나머지 노드가 이를 거부**한다. 그제서야 **"누구도 믿지 않아도 되는" 블록체인**이 성립한다.

### 내결함성 참고 (QBFT)

QBFT는 **`3f+1`** 개의 검증자로 **`f`** 개의 장애/악의적 노드를 견딘다.

| 검증자 수 | 견딜 수 있는 장애 노드 |
|-----------|----------------------|
| 4 | 1 |
| 7 | 2 |
| 10 | 3 |

**독립 주체가 많을수록 더 안전하고 더 신뢰할 수 있다.**

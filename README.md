# 블록체인 기반 의료 장비 관리 시스템
2025.10.01 ~ 개발 진행 중

## 프로젝트 개요

본 프로젝트는 병원 내 의료 장비 사용 이력을 블록체인 기반으로 관리하여, 장비 사용 이력의 투명성과 무결성을 확보하는 것을 목표로 한다.
저전력 블루투스 기반 RTLS(Real-Time Location System)를 개발하여 장비의 위치 정보를 실시간으로 수집함으로써 의료진이 필요한 장비를 신속하게 파악할 수 있도록 하며, 
NFC(Near Field Communication) 기반 사용자 인증을 개발하여 인가된 의료진만 장비를 사용할 수 있도록 한다. 
이러한 정보를 바탕으로 장비 사용 이력은 자동으로 기록되며, 이를 통해 의료진이 수기로 기록하던 기존 방식의 한계를 개선하여 정확하고 효율적인 장비 관리 환경을 제공한다.


## 프로젝트 기획 배경

기존 의료 장비 관리 방식은 다음과 같은 문제가 발생합니다.

- 장비 위치 파악 지연
- 사용 이력 누락 및 위·변조 위험
- 책임 추적성 확보의 어려움

본 시스템은 BLE RTLS와 NFC 인증을 결합해 장비 사용 이력을 자동 생성하고, 해당 이력의 해시를 블록체인에 저장해 위변조 여부를 검증합니다.


## 핵심 기능

1. BLE RTLS(RSSI) 기반 실시간 장비 위치 추적
2. NFC 태깅 기반 사용자 인증 및 사용자 정보 수집
3. 장비 사용 이력 자동 생성
4. 생성된 이력의 DB 저장(오프체인)
5. 이력 해시의 블록체인 저장(온체인)
6. DB-블록체인 해시 대조 무결성 검증
7. 이력 변경(변조) 탐지

## 프로젝트 개략도

### 시나리오
<img width="1355" height="932" alt="Image" src="https://github.com/user-attachments/assets/b1d5a2c2-7f9a-4134-b2aa-58194057f0b5" />

### Deployment Diagram
<img width="1734" height="1342" alt="Image" src="https://github.com/user-attachments/assets/a56becdf-aa3d-44c9-96e6-cf5442977b93" />

## 기술 스택

- Backend: FastAPI, PostgreSQL
- Frontend: React (Vite)
- Blockchain: Hyperledger Besu


## 실행 방법

### Backend

요구사항:
- Python 3.10 이상
- PostgreSQL

실행:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cp .env.example .env
bash scripts/init-db.sh
uvicorn backend.server:app --reload
```

### Frontend

요구사항:
- Node.js 18 이상

실행:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

### Blockchain

개발용 프라이빗 블록체인은 `blockchain/besu` 아래에 구성합니다.

구성:
- Hyperledger Besu
- QBFT
- 4 validator + 1 RPC 노드

실행:

```bash
bash blockchain/besu/scripts/generate-network.sh
cd blockchain/besu
docker compose up -d
```

검증:

```bash
bash blockchain/besu/scripts/check-network.sh
```

환경 파일:

- 루트 `.env`: 백엔드 DB/CORS 설정
- `frontend/.env`: 프론트 API 엔드포인트
- `rtls/.env`: RTLS 리더가 호출할 서버 주소와 리더 ID
- `blockchain/besu/.env`: Besu 이미지와 bootnode 정보

각 예시는 `.env.example` 파일로 제공합니다.

DB 초기 구성 방법은 [docs/POSTGRES_SETUP.md](docs/POSTGRES_SETUP.md)를 참고하세요.

## 새 장비 이전 / Private Repo 정리

새 맥북으로 개발 환경을 옮길 때는 파일 전체를 복사하거나 모든 로컬 파일을 Git에 넣기보다, 아래처럼 분리하는 방식이 안전합니다.

- Git에 올릴 것: 소스코드, 문서, 의존성 파일, `.env.example`, Docker/compose 설정
- Git에 올리지 말 것: `.env`, DB 실데이터, Besu validator 키, 체인 상태 데이터, `.venv`, `node_modules`
- Besu 실행 산출물은 `generate-network.sh`로 다시 생성하거나 별도 백업으로 이전

상세 체크리스트는 [docs/MACBOOK_PRIVATE_REPO_MIGRATION.md](docs/MACBOOK_PRIVATE_REPO_MIGRATION.md)를 참고하세요.


## 무결성 검증 흐름

1. RTLS/NFC 이벤트 기반으로 장비 사용 이력 자동 생성
2. 원본 이력을 DB에 저장
3. 동일 이력의 해시를 블록체인에 기록
4. 검증 시 DB 이력을 다시 해시화
5. 블록체인 해시와 비교하여 일치 여부 확인
6. 불일치 시 변조된 이력으로 표시


## 기대 효과

- 의료 장비 사용 이력의 투명성/신뢰성 확보
- 의료진의 장비 탐색 시간 단축
- 이력 위변조 탐지 기반 감사 대응 강화
- 수기 업무 감소를 통한 운영 효율 개선

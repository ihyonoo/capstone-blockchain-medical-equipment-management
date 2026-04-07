# 맥북 이전 및 Private Repo 정리 가이드

## 목적

새 맥북에서 이 프로젝트를 다시 세팅할 때, 코드와 로컬 실행 상태를 분리해서 안전하게 이전한다.

- 코드와 설정 템플릿은 Git으로 관리한다.
- 시크릿과 실행 상태는 Git 밖에서 별도 백업/복원한다.
- Private repo를 사용하더라도 민감 정보와 대용량 생성물은 커밋하지 않는다.

## Private Repo에 올릴 항목

- `backend/`, `frontend/`, `rtls/`, `blockchain/` 소스코드
- `README.md`와 문서
- `backend/requirements.txt`, `rtls/requirements.txt`
- `frontend/package.json`, `frontend/package-lock.json`
- `blockchain/besu/package.json`, `blockchain/besu/package-lock.json`
- `.env.example`, `frontend/.env.example`, `rtls/.env.example`, `blockchain/besu/.env.example`

## Private Repo에 올리면 안 되는 항목

- 루트 `.env`와 각 서비스의 실제 `.env`
- PostgreSQL 실데이터와 dump 파일
- `blockchain/besu/config/genesis.json`
- `blockchain/besu/validators/*/data/key`
- `blockchain/besu/validators/*/address`
- `blockchain/besu/rpc-node/data/key`
- `.venv/`, `node_modules/`, 빌드 산출물, 로그

## 추천 이전 절차

1. 현재 PC에서 Git 상태를 정리한다.
2. 시크릿은 비밀번호 관리자나 암호화 압축 파일로 별도 백업한다.
3. DB를 유지해야 하면 PostgreSQL dump를 만든다.
4. Besu 체인 상태를 유지해야 하면 `blockchain/besu`의 생성 산출물을 Git 밖으로 압축 백업한다.
5. 새 맥북에서 private repo를 clone한다.
6. Python, Node.js, Docker Desktop, PostgreSQL, OpenSSL을 설치한다.
7. `.env.example` 파일들을 기준으로 실제 `.env`를 복원한다.
8. PostgreSQL에 스키마를 적용한다.
9. 백엔드, 프론트, Besu를 순서대로 기동한다.

## 새 맥북 세팅 순서

### 1. 저장소 클론

```bash
git clone <your-private-repo-url>
cd <repo-name>
```

### 2. Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cp .env.example .env
bash scripts/init-db.sh
uvicorn backend.server:app --reload
```

스키마 상세는 [docs/POSTGRES_SETUP.md](docs/POSTGRES_SETUP.md)를 참고한다.

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

### 4. RTLS Reader

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r rtls/requirements.txt
cp rtls/.env.example rtls/.env
```

`RTLS_SERVER_URL`은 리더 장비에서 접근 가능한 백엔드 주소로 바꿔야 한다.

### 5. Besu

```bash
bash blockchain/besu/scripts/generate-network.sh
cd blockchain/besu
docker compose up -d
```

체인 상태를 이전하지 않는다면 위 방식으로 새 네트워크를 생성한다. 이 과정에서 `blockchain/besu/.env`도 함께 생성된다.

## 상태를 유지해야 할 때

- PostgreSQL: dump 파일을 새 맥북 DB에 복원
- Besu: 기존 `genesis.json`, validator 키, rpc-node key, `.env`를 별도 백업본에서 복원

이 데이터는 Git 커밋이 아니라 로컬 백업으로 관리하는 편이 안전하다.

## 최종 점검

- 백엔드가 `DATABASE_URL`로 PostgreSQL에 연결되는지 확인
- 프론트가 `VITE_API_BASE_URL`로 백엔드에 연결되는지 확인
- RTLS 리더가 `RTLS_SERVER_URL`로 `/ingest`에 전송되는지 확인
- Besu RPC가 `http://127.0.0.1:8549`에서 응답하는지 확인

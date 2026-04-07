# PostgreSQL 초기 구성

## 목적

새 장비에서 기존 데이터 없이도 동일한 DB 구조를 다시 만들 수 있도록,
현재 백엔드 코드가 기대하는 스키마를 SQL 파일로 버전 관리한다.

핵심 파일:

- `database/schema.sql`
- `scripts/init-db.sh`

## 포함된 테이블

- `users`
- `readers`
- `tags`
- `tag_state_history`
- `usage_history`

`usage_history`는 현재 코드 기준으로 조회 전용 스냅샷 테이블이다.  
즉, 이력 데이터는 비어 있어도 되지만 테이블 구조는 있어야 화면과 API가 정상 동작한다.

## 새 맥북에서 적용 순서

### 1. PostgreSQL 설치 후 데이터베이스 생성

예시:

```bash
createdb rtls
```

또는:

```bash
psql postgres -c "CREATE DATABASE rtls;"
```

### 2. 루트 `.env` 준비

```bash
cp .env.example .env
```

필요하면 `DATABASE_URL`을 실제 계정/비밀번호에 맞게 수정한다.

### 3. 스키마 적용

```bash
bash scripts/init-db.sh
```

직접 적용하려면:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/schema.sql
```

## 확인 포인트

- `users`에 `role`, `position`, `password_hash`가 존재하는지
- `tags`에 `equipment_type`, `serial_number`가 존재하는지
- `tag_state_history`가 태그 위치 이력을 저장할 수 있는지
- `usage_history` 조회 API가 빈 결과라도 정상 응답하는지

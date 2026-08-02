# database

MediLedger EquipTrace의 PostgreSQL 스키마.

## 적용

```bash
psql "$DATABASE_URL" -f database/schema.sql
```

로컬 개발 접속 문자열: `postgresql://mediledger:mediledger@localhost:5432/mediledger_db` (`docker-compose.dev.yml`로 띄운 컨테이너 기준).

## 구성

- `schema.sql` — 전체 스키마(테이블, 제약, 인덱스). 멱등적이라 재실행해도 안전하다.

테이블 목록과 각 테이블의 역할은 [CLAUDE.md](CLAUDE.md)를 참고한다.

# frontend

Locuvera의 React 18 + Vite + TailwindCSS SPA.

## 설치

```bash
npm install
```

## 실행

```bash
npm run dev            # Vite 개발 서버, :5173
npm run dev:lan        # 같은 LAN의 기기용으로 0.0.0.0 바인딩
npm run build           # tsc + vite build; 변경 후 검증용으로 실행
```

테스트 러너나 린터는 구성되어 있지 않다. `npm run build`가 검증 단계다.

## 환경 변수 (`frontend/.env`)

- `VITE_API_BASE_URL` — 백엔드 API 주소. 비워두면 `<protocol>//<hostname>:8000`으로 폴백한다.

## 관련 문서

- [CLAUDE.md](CLAUDE.md) — 구조, 디자인 시스템

# backend/Dockerfile
FROM python:3.12-slim

# Node.js 20 설치 (besu 스크립트 subprocess 실행용)
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 파이썬 의존성
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# besu 스크립트 의존성 (ethers/solc). package.json 기준 설치
COPY blockchain/besu/package.json blockchain/besu/package-lock.json* blockchain/besu/
RUN cd blockchain/besu && npm ci --omit=dev || npm install --omit=dev

# 애플리케이션 소스
COPY backend/ backend/
COPY blockchain/besu/scripts/ blockchain/besu/scripts/
COPY blockchain/besu/contracts/ blockchain/besu/contracts/

EXPOSE 8000
CMD ["uvicorn", "backend.server:app", "--host", "0.0.0.0", "--port", "8000"]

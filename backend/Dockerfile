# backend/Dockerfile

# Python 3.12의 slim 변형: 풀 이미지 대비 불필요한 패키지가 빠져 이미지 용량이 작음
FROM python:3.12-slim

# Node.js 20 설치 (besu 스크립트 subprocess 실행용).
# backend/usage_history_service.py 가 python 라이브러리로 체인과 통신하지 않고
# blockchain/besu/scripts/*.mjs 를 subprocess로 셸 아웃 호출하기 때문에,
# 같은 컨테이너 안에 Node 런타임이 함께 있어야 한다.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates gnupg \
    # NodeSource의 setup 스크립트가 Node 20 전용 apt 저장소를 등록해준다
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    # apt 캐시 삭제: 레이어 용량을 줄이기 위한 관례적 정리
    && rm -rf /var/lib/apt/lists/*

# 이후 모든 명령(COPY/RUN/CMD)의 기준 디렉터리.
WORKDIR /app

# 파이썬 의존성.
# requirements.txt만 먼저 COPY하고 설치하는 이유는 Docker 레이어 캐싱 때문 —
COPY backend/requirements.txt backend/requirements.txt
# --no-cache-dir: pip이 다운로드한 wheel 캐시를 이미지에 남기지 않아 용량 절감
# (컨테이너는 재빌드 시 매번 새로 pip install 하므로 캐시를 남길 이유가 없다).
RUN pip install --no-cache-dir -r backend/requirements.txt

# besu 스크립트 의존성 (ethers/solc). package.json 기준 설치.
# 위 pip 캐싱과 같은 이유로 package.json/lock만 먼저 COPY한다.
COPY blockchain/besu/package.json blockchain/besu/package-lock.json* blockchain/besu/
# npm ci: package-lock.json을 정확히 그대로 재현하는 결정적 설치(빌드 재현성 확보).
# lock 파일이 없을 수도 있으므로(COPY의 package-lock.json*는 없어도 에러 안 남)
# 그 경우엔 npm install로 폴백한다. --omit=dev: 런타임에 필요 없는 devDependencies는
# 제외해 이미지 용량과 공급망 표면을 줄인다.
RUN cd blockchain/besu && npm ci --omit=dev || npm install --omit=dev

# 애플리케이션 소스.
COPY backend/ backend/
# usage_history_service.py가 subprocess로 호출하는 Node 스크립트들과,
# 그 스크립트가 참조하는 컨트랙트 ABI/아티팩트만 선별 복사한다
# (besu 네트워크 설정·genesis 등은 백엔드 이미지에 불필요하므로 제외).
COPY blockchain/besu/scripts/ blockchain/besu/scripts/
COPY blockchain/besu/contracts/ blockchain/besu/contracts/

# 문서화 목적의 선언일 뿐 실제로 포트를 열지는 않는다(포트 게시는 compose의
# `ports:`가 담당). 컨테이너가 8000번으로 서빙한다는 것을 이미지 메타데이터에 남긴다.
EXPOSE 8000

# --host 0.0.0.0: 컨테이너 루프백(127.0.0.1)이 아니라 모든 인터페이스로 바인딩해야 컨테이너 밖(다른 서비스, 호스트)에서 접근 가능하다.
#127.0.0.1로 바인딩하면 컨테이너 내부에서만 접근되어 사실상 외부에서 응답을 받을 수 없다.
CMD ["uvicorn", "backend.server:app", "--host", "0.0.0.0", "--port", "8000"]

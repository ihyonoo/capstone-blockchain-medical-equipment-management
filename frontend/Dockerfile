# frontend/Dockerfile

# 멀티스테이지 빌드: 1단계(build)에서 Node로 정적 파일을 만들고, 
# 2단계(최종 이미지)는 결과물(dist/)만 nginx 이미지에 옮겨 담는다. 
# node_modules·소스·빌드 툴체인은 최종 이미지에 전혀 남지 않아 배포 이미지 용량이 크게 줄어든다.

# --- 1단계: 빌드 스테이지 (이 스테이지 자체는 최종 이미지에 포함되지 않는다) ---
FROM node:20-slim AS build
WORKDIR /app

# package.json/lock만 먼저 COPY하는 이유는 backend/Dockerfile과 동일 —
# 소스만 바뀐 재빌드에서 npm ci 레이어를 캐시로 재사용하기 위한 레이어 캐싱 최적화.
COPY package.json package-lock.json* ./

# lock 파일을 정확히 그대로 재현하는 결정적 설치. (여기선 --omit=dev를 쓰지 않는다 —
# vite/tsc 등 빌드 도구가 devDependencies에 있고, 이 스테이지에서 빌드까지 수행해야
# 하기 때문. 어차피 build 스테이지 자체는 최종 이미지에 남지 않는다.)
RUN npm ci

# 나머지 소스 전체(src/, public/, 설정 파일 등) 복사.
COPY . .

# 같은 오리진 /api로 백엔드 호출하도록 빌드.
# Vite는 이 값을 "런타임"이 아니라 "빌드 시점"에 정적 JS 번들 안에 그대로
# 박아 넣는다(import.meta.env.VITE_API_BASE_URL). 그래서 컨테이너 실행 중에
# 환경변수를 바꿔도 반영되지 않고, 반드시 이 시점에 고정해야 한다. frontend/lib/runtime.ts가
# 이 값을 읽어 API_BASE_URL을 만든다.
ENV VITE_API_BASE_URL=/api

# tsc(타입 체크) + vite build → frontend/dist/ 에 정적 HTML/JS/CSS 산출.
RUN npm run build

# --- 2단계: 최종 이미지 (실제로 배포/실행되는 이미지) ---
# 빌드 스테이지와 무관한 새 베이스. nginx:1.27-alpine은 정적 파일 서빙에만
# 필요한 최소 구성이라 Node 런타임 전체를 배포 이미지에 남기지 않는다.
FROM nginx:1.27-alpine

# --from=build: 앞선 "build" 스테이지의 파일시스템에서 dist/ 산출물만 가져온다.
# nginx의 기본 정적 파일 루트(/usr/share/nginx/html)에 그대로 배치.
COPY --from=build /app/dist /usr/share/nginx/html

# nginx의 실제 라우팅/프록시 설정(deploy/nginx.conf, /api를 backend로 리버스
# 프록시하는 규칙 등)은 이 이미지에 굽지 않는다 — 루트 docker-compose.yml의
# web 서비스가 런타임에 볼륨 마운트(`./deploy/nginx.conf:/etc/nginx/conf.d/default.conf:ro`)로
# 주입한다. 그래야 nginx 설정만 바꿀 때 이미지 재빌드 없이 컨테이너만 재시작하면 된다.
EXPOSE 80

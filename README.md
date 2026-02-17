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

### 프로젝트 시나리오
<img width="1355" height="932" alt="Image" src="https://github.com/user-attachments/assets/b1d5a2c2-7f9a-4134-b2aa-58194057f0b5" />

### Deployment Diagram
<img width="1734" height="1342" alt="Image" src="https://github.com/user-attachments/assets/a56becdf-aa3d-44c9-96e6-cf5442977b93" />

## 시스템 구조

```text
[BLE Beacon / RTLS] ----\
                         +--> [Backend API] --> [PostgreSQL]
[NFC 인증 단말] --------/           |
                                +--> [Hyperledger Besu]
                                        (이력 해시 저장)
```


## 기술 스택

- Backend: FastAPI, PostgreSQL
- Frontend: React (Vite)
- Blockchain: Hyperledger Besu


## 실행 방법

### Backend

요구사항:
- Python 3.10 이상

실행:

```bash
uvicorn app.main:app --reload
```

### Frontend

요구사항:
- Node.js 18 이상

실행:

```bash
cd front
npm install
npm run dev
```


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
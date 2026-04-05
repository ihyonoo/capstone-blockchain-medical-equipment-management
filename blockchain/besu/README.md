# Hyperledger Besu QBFT Network

이 디렉터리는 개발용 프라이빗 블록체인 네트워크를 위한 Hyperledger Besu + QBFT 구성 파일을 포함합니다.

구성:

- Validator 4대
- Non-validator RPC 노드 1대
- Docker Compose 기반 단일 호스트 개발 환경

기본 포트:

- `validator1` RPC `8545`, P2P `30303`
- `validator2` RPC `8546`, P2P `30304`
- `validator3` RPC `8547`, P2P `30305`
- `validator4` RPC `8548`, P2P `30306`
- `rpc-node` RPC `8549`, P2P `30307`

앱 연결 기본 엔드포인트:

- `http://127.0.0.1:8549`

## 준비 사항

- Docker 실행 가능 환경
- `openssl`

## 실행 순서

프로젝트 루트에서 아래 순서로 실행합니다.

```bash
bash blockchain/besu/scripts/generate-network.sh
cd blockchain/besu
docker compose up -d
```

네트워크 상태 확인:

```bash
bash blockchain/besu/scripts/check-network.sh
```

중지:

```bash
cd blockchain/besu
docker compose down
```

## 생성 파일

`generate-network.sh` 실행 후 아래 파일들이 생성됩니다.

- `config/genesis.json`
- `validators/validator*/data/key`
- `validators/validator*/data/key.pub`
- `validators/validator*/address`
- `rpc-node/data/key`
- `.env`

위 파일들은 개발용 산출물이므로 Git 추적에서 제외됩니다.

## 참고

- 이 구성은 개발/데모용 단일 호스트 네트워크입니다.
- 방화벽, permissioning, Web3Signer, TLS, 운영용 키 관리 체계는 포함하지 않습니다.
- 백엔드가 해시를 온체인에 기록/조회하는 로직은 아직 연결하지 않았습니다.

## 수동 해시 기록

백엔드나 DB를 연결하지 않고, 사용자가 직접 `usageId`와 `usageHash`를 입력해 체인에 기록할 수 있습니다.

준비:

```bash
cd blockchain/besu
npm install
```

컨트랙트 배포:

```bash
cd blockchain/besu
node scripts/deploy-usage-registry.mjs
```

배포 결과는 `deployments/usage-registry.json`에 저장됩니다.

해시 기록:

```bash
cd blockchain/besu
node scripts/record-usage-hash.mjs usage-0001 0x1111111111111111111111111111111111111111111111111111111111111111
```

저장값 조회:

```bash
cd blockchain/besu
node scripts/read-usage-hash.mjs usage-0001
```

기본 설정:

- RPC: `http://127.0.0.1:8549`
- Chain ID: `1337`
- 기본 서명 계정: genesis에 포함된 개발용 prefunded 계정

주의:

- `usageHash`는 반드시 `0x`로 시작하는 32바이트 hex 문자열이어야 합니다.
- 현재 스크립트는 동일한 `usageId`를 다시 기록하지 못하게 막습니다.
- 개발용 계정 키를 사용하므로 운영 환경에는 그대로 쓰면 안 됩니다.

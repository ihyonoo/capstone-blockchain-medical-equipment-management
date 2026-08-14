import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';
import { ethers } from 'ethers';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT_PATH = path.join(ROOT_DIR, 'contracts', 'UsageRecordRegistry.sol');
const DEPLOYMENT_PATH = path.join(ROOT_DIR, 'deployments', 'usage-registry.json');
const RPC_URL = process.env.BESU_RPC_URL ?? 'http://127.0.0.1:8549';
const CHAIN_ID = Number(process.env.BESU_CHAIN_ID ?? '1337');
const SENDER_PRIVATE_KEY =
  process.env.BESU_SENDER_PRIVATE_KEY ?? 'ae6ae8e5ccbfb04590405997ee2d52d2b330726137b875053c36d94e974d162f';

function compileContract() {
  // 배포 파일에는 ABI만 따로 저장하지 않기 때문에, 전송 시점에 계약을 다시 해석한다.
  const source = fs.readFileSync(CONTRACT_PATH, 'utf8');
  const input = {
    language: 'Solidity',
    sources: {
      'UsageRecordRegistry.sol': {
        content: source,
      },
    },
    settings: {
      evmVersion: 'berlin',
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
      outputSelection: {
        '*': {
          '*': ['abi'],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = output.errors ?? [];
  const fatalErrors = errors.filter((item) => item.severity === 'error');

  if (fatalErrors.length > 0) {
    throw new Error(fatalErrors.map((item) => item.formattedMessage).join('\n'));
  }

  return output.contracts['UsageRecordRegistry.sol'].UsageRecordRegistry.abi;
}

function normalizeString(value) {
  return typeof value === 'string' ? value : '';
}

function normalizeInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return parsed;
}

function normalizeMovementPath(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((point, index) => {
    if (!point || typeof point !== 'object') {
      throw new Error(`movementPath[${index}] must be an object`);
    }
    return {
      location: normalizeString(point.location),
      at: normalizeInteger(point.at, `movementPath[${index}].at`),
    };
  });
}

function normalizePayload(value) {
  const payload = JSON.parse(value);
  if (!payload || typeof payload !== 'object') {
    throw new Error('payload must be a JSON object');
  }

  // 검증 가능한 원문 필드만 계약 입력 형태로 고정한다.
  return {
    usageId: normalizeString(payload.usageId),
    checkoutUserId: normalizeInteger(payload.checkoutUserId, 'checkoutUserId'),
    returnUserId: normalizeInteger(payload.returnUserId, 'returnUserId'),
    tagId: normalizeString(payload.tagId),
    checkoutLocation: normalizeString(payload.checkoutLocation),
    checkoutAt: normalizeInteger(payload.checkoutAt, 'checkoutAt'),
    returnLocation: normalizeString(payload.returnLocation),
    returnedAt: normalizeInteger(payload.returnedAt, 'returnedAt'),
    movementPath: normalizeMovementPath(payload.movementPath),
  };
}

async function main() {
  const payloadInput = process.argv[2];

  if (!payloadInput) {
    throw new Error("usage: node scripts/record-usage-record.mjs '<json-payload>'");
  }

  if (!fs.existsSync(DEPLOYMENT_PATH)) {
    throw new Error('deployment file not found. run deploy-usage-registry.mjs first');
  }

  const payload = normalizePayload(payloadInput);
  const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_PATH, 'utf8'));
  const abi = compileContract();
  const provider = new ethers.JsonRpcProvider(RPC_URL, {
    name: 'besu-qbft',
    chainId: CHAIN_ID,
  });
  const wallet = new ethers.Wallet(SENDER_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(deployment.address, abi, wallet);

  // 사용 이력 1건을 체인에 기록하고, 이후 조회에 필요한 앵커 메타데이터를 함께 반환한다.
  const tx = await contract.recordUsageRecord(
    payload.usageId,
    payload.checkoutUserId,
    payload.returnUserId,
    payload.tagId,
    payload.checkoutLocation,
    payload.checkoutAt,
    payload.returnLocation,
    payload.returnedAt,
    payload.movementPath,
    {
      gasPrice: ethers.parseUnits('1', 'gwei'),
      type: 0,
    },
  );
  const receipt = await tx.wait();
  const storedRecord = await contract.getUsageRecord(payload.usageId);

  console.log(
    JSON.stringify(
      {
        ...payload,
        contract: deployment.address,
        sender: wallet.address,
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber ?? null,
        blockHash: receipt?.blockHash ?? null,
        transactionIndex: receipt?.index ?? receipt?.transactionIndex ?? null,
        recordedAt: storedRecord ? Number(storedRecord[7]) : null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

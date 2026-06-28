import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";
import { ethers } from "ethers";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT_PATH = path.join(ROOT_DIR, "contracts", "UsageRecordRegistry.sol");

function compileContractAbi() {
  const source = fs.readFileSync(CONTRACT_PATH, "utf8");
  const input = {
    language: "Solidity",
    sources: {
      "UsageRecordRegistry.sol": {
        content: source,
      },
    },
    settings: {
      evmVersion: "berlin",
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
      outputSelection: {
        "*": {
          "*": ["abi"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = output.errors ?? [];
  const fatalErrors = errors.filter((item) => item.severity === "error");

  if (fatalErrors.length > 0) {
    throw new Error(fatalErrors.map((item) => item.formattedMessage).join("\n"));
  }

  return output.contracts["UsageRecordRegistry.sol"].UsageRecordRegistry.abi;
}

function hexToBigInt(hex) {
  return BigInt(hex);
}

function hexToNumberIfSafe(hex) {
  const value = hexToBigInt(hex);
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString();
}

function hexToAscii(hex) {
  const bytes = ethers.getBytes(hex);
  const filtered = bytes.filter((byte) => byte !== 0);
  if (filtered.length === 0) {
    return "";
  }

  try {
    return ethers.toUtf8String(filtered);
  } catch {
    return "";
  }
}

function formatTimestamp(hex) {
  const epoch = Number(hexToBigInt(hex));
  const date = new Date(epoch * 1000);
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);

  return {
    epoch,
    utc: date.toISOString(),
    kst: kst.toISOString().replace("T", " ").replace(".000Z", " KST"),
  };
}

function normalizeDecodedArg(value) {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeDecodedArg);
  }

  return value;
}

function decodeInput(iface, tx) {
  try {
    const parsed = iface.parseTransaction({ data: tx.input, value: tx.value });
    if (!parsed) {
      return {
        raw: tx.input,
        selector: tx.input.slice(0, 10),
        decoded: null,
      };
    }

    const args = {};
    parsed.fragment.inputs.forEach((input, index) => {
      args[input.name || `arg${index}`] = normalizeDecodedArg(parsed.args[index]);
    });

    return {
      raw: tx.input,
      selector: tx.input.slice(0, 10),
      functionName: parsed.name,
      args,
    };
  } catch {
    return {
      raw: tx.input,
      selector: tx.input.slice(0, 10),
      decoded: null,
    };
  }
}

function decodeExtraData(extraDataHex) {
  const decoded = ethers.decodeRlp(extraDataHex);
  const vanityRaw = decoded[0];
  const validators = Array.isArray(decoded[1]) ? decoded[1].map((item) => ethers.getAddress(item)) : [];
  const vote = decoded[2];
  const roundHex = decoded[3];
  const commitSeals = Array.isArray(decoded[4]) ? decoded[4] : [];

  return {
    raw: extraDataHex,
    vanity: {
      raw: vanityRaw,
      text: hexToAscii(vanityRaw),
    },
    validators,
    vote: Array.isArray(vote) ? vote : vote === "0x" ? [] : vote,
    round: roundHex === "0x" ? 0 : hexToNumberIfSafe(roundHex),
    commitSeals,
  };
}

function humanizeTransaction(iface, tx) {
  return {
    hash: tx.hash,
    blockHash: tx.blockHash,
    from: tx.from,
    to: tx.to,
    nonce: hexToNumberIfSafe(tx.nonce),
    blockNumber: hexToNumberIfSafe(tx.blockNumber),
    blockTimestamp: formatTimestamp(tx.blockTimestamp),
    chainId: hexToNumberIfSafe(tx.chainId),
    gasLimit: hexToNumberIfSafe(tx.gas),
    gasPriceWei: hexToBigInt(tx.gasPrice).toString(),
    gasPriceGwei: ethers.formatUnits(tx.gasPrice, "gwei"),
    valueWei: hexToBigInt(tx.value).toString(),
    valueEther: ethers.formatEther(tx.value),
    transactionIndex: hexToNumberIfSafe(tx.transactionIndex),
    type: tx.type === "0x0" ? "legacy" : tx.type,
    signature: {
      v: tx.v,
      r: tx.r,
      s: tx.s,
    },
    input: decodeInput(iface, tx),
  };
}

function humanizeBlock(iface, payload) {
  const block = payload.raw;

  return {
    batchIndex: payload.batchIndex,
    header: {
      number: hexToNumberIfSafe(block.number),
      hash: block.hash,
      parentHash: block.parentHash,
      miner: block.miner,
      timestamp: formatTimestamp(block.timestamp),
      nonce: hexToNumberIfSafe(block.nonce),
      sizeBytes: hexToNumberIfSafe(block.size),
      gasLimit: hexToNumberIfSafe(block.gasLimit),
      gasUsed: hexToNumberIfSafe(block.gasUsed),
      difficulty: hexToNumberIfSafe(block.difficulty),
      totalDifficulty: hexToNumberIfSafe(block.totalDifficulty),
      mixHash: {
        raw: block.mixHash,
        text: hexToAscii(block.mixHash),
      },
      logsBloom: {
        raw: block.logsBloom,
        description: "Bloom filter bitset for block logs",
      },
      sha3Uncles: block.sha3Uncles,
      transactionsRoot: block.transactionsRoot,
      stateRoot: block.stateRoot,
      receiptsRoot: block.receiptsRoot,
      extraData: decodeExtraData(block.extraData),
      uncles: block.uncles,
      transactionCount: Array.isArray(block.transactions) ? block.transactions.length : 0,
    },
    body: {
      transactions: Array.isArray(block.transactions)
        ? block.transactions.map((tx) => humanizeTransaction(iface, tx))
        : [],
    },
  };
}

function main() {
  const inputPath =
    process.argv[2] ?? path.join(ROOT_DIR, "examples", "usage-record-batch-5x30-blocks.json");
  const outputPath =
    process.argv[3] ?? path.join(ROOT_DIR, "examples", "usage-record-batch-5x30-blocks.human.json");

  const payload = JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8"));
  if (!Array.isArray(payload.blocks)) {
    throw new Error("expected blocks array in multiblock payload");
  }

  const abi = compileContractAbi();
  const iface = new ethers.Interface(abi);

  const humanized = {
    blockCount: payload.blocks.length,
    blocks: payload.blocks.map((block) => humanizeBlock(iface, block)),
  };

  fs.writeFileSync(path.resolve(outputPath), JSON.stringify(humanized, null, 2));
  console.log(
    JSON.stringify(
      {
        inputPath: path.resolve(inputPath),
        outputPath: path.resolve(outputPath),
        blockCount: humanized.blockCount,
      },
      null,
      2,
    ),
  );
}

main();

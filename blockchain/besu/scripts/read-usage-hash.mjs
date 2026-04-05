import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";
import { ethers } from "ethers";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT_PATH = path.join(ROOT_DIR, "contracts", "UsageHashRegistry.sol");
const DEPLOYMENT_PATH = path.join(ROOT_DIR, "deployments", "usage-registry.json");
const RPC_URL = process.env.BESU_RPC_URL ?? "http://127.0.0.1:8549";
const CHAIN_ID = Number(process.env.BESU_CHAIN_ID ?? "1337");

function compileContract() {
  const source = fs.readFileSync(CONTRACT_PATH, "utf8");
  const input = {
    language: "Solidity",
    sources: {
      "UsageHashRegistry.sol": {
        content: source,
      },
    },
    settings: {
      evmVersion: "berlin",
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

  return output.contracts["UsageHashRegistry.sol"].UsageHashRegistry.abi;
}

async function main() {
  const usageId = process.argv[2];

  if (!usageId) {
    throw new Error("usage: node scripts/read-usage-hash.mjs <usageId>");
  }

  if (!fs.existsSync(DEPLOYMENT_PATH)) {
    throw new Error("deployment file not found. run deploy-usage-registry.mjs first");
  }

  const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_PATH, "utf8"));
  const abi = compileContract();
  const provider = new ethers.JsonRpcProvider(RPC_URL, {
    name: "besu-qbft",
    chainId: CHAIN_ID,
  });
  const contract = new ethers.Contract(deployment.address, abi, provider);
  const record = await contract.getUsageRecord(usageId);

  console.log(
    JSON.stringify(
      {
        usageId,
        usageHash: record[0],
        recordedAt: Number(record[1]),
        recorder: record[2],
        exists: record[3],
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

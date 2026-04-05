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
const SENDER_PRIVATE_KEY =
  process.env.BESU_SENDER_PRIVATE_KEY ??
  "ae6ae8e5ccbfb04590405997ee2d52d2b330726137b875053c36d94e974d162f";

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

function normalizeHash(value) {
  if (!ethers.isHexString(value, 32)) {
    throw new Error("usageHash must be a 32-byte hex string such as 0x1234...");
  }

  return value.toLowerCase();
}

async function main() {
  const usageId = process.argv[2];
  const usageHashInput = process.argv[3];

  if (!usageId || !usageHashInput) {
    throw new Error("usage: node scripts/record-usage-hash.mjs <usageId> <usageHash>");
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
  const wallet = new ethers.Wallet(SENDER_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(deployment.address, abi, wallet);
  const usageHash = normalizeHash(usageHashInput);

  console.log(`recording usageId: ${usageId}`);
  console.log(`usageHash: ${usageHash}`);
  console.log(`contract: ${deployment.address}`);
  console.log(`sender: ${wallet.address}`);

  const tx = await contract.recordUsageHash(usageId, usageHash, {
    gasPrice: ethers.parseUnits("1", "gwei"),
    type: 0,
  });
  const receipt = await tx.wait();

  console.log(`tx hash: ${tx.hash}`);
  console.log(`block number: ${receipt?.blockNumber ?? "unknown"}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

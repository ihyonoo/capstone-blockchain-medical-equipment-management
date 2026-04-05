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
const DEPLOYER_PRIVATE_KEY =
  process.env.BESU_DEPLOYER_PRIVATE_KEY ??
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
          "*": ["abi", "evm.bytecode.object"],
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

  return output.contracts["UsageHashRegistry.sol"].UsageHashRegistry;
}

async function main() {
  const compiled = compileContract();
  const provider = new ethers.JsonRpcProvider(RPC_URL, {
    name: "besu-qbft",
    chainId: CHAIN_ID,
  });
  const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
  const factory = new ethers.ContractFactory(compiled.abi, compiled.evm.bytecode.object, wallet);

  console.log(`Deploying UsageHashRegistry to ${RPC_URL} ...`);
  console.log(`deployer: ${wallet.address}`);

  const contract = await factory.deploy({
    gasPrice: ethers.parseUnits("1", "gwei"),
    type: 0,
  });
  const deploymentTx = contract.deploymentTransaction();

  if (!deploymentTx) {
    throw new Error("deployment transaction not found");
  }

  const receipt = await deploymentTx.wait();

  fs.mkdirSync(path.dirname(DEPLOYMENT_PATH), { recursive: true });
  fs.writeFileSync(
    DEPLOYMENT_PATH,
    JSON.stringify(
      {
        contractName: "UsageHashRegistry",
        address: await contract.getAddress(),
        chainId: CHAIN_ID,
        rpcUrl: RPC_URL,
        deploymentTxHash: deploymentTx.hash,
        deploymentBlockNumber: receipt?.blockNumber ?? null,
        deployer: wallet.address,
      },
      null,
      2,
    ),
  );

  console.log(`contract address: ${await contract.getAddress()}`);
  console.log(`deployment tx: ${deploymentTx.hash}`);
  console.log(`deployment block: ${receipt?.blockNumber ?? "unknown"}`);
  console.log(`saved deployment: ${DEPLOYMENT_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

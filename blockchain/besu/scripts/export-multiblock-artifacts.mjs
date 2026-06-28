import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RPC_URL = process.env.BESU_RPC_URL ?? "http://127.0.0.1:8549";
const CHAIN_ID = Number(process.env.BESU_CHAIN_ID ?? "1337");

function toHexBlockNumber(value) {
  return `0x${Number(value).toString(16)}`;
}

async function main() {
  const resultPath =
    process.argv[2] ?? path.join(ROOT_DIR, "examples", "usage-record-batch-5x30-result.json");
  const outputPath =
    process.argv[3] ?? path.join(ROOT_DIR, "examples", "usage-record-batch-5x30-blocks.json");

  const result = JSON.parse(fs.readFileSync(path.resolve(resultPath), "utf8"));
  if (!Array.isArray(result.blocks) || result.blocks.length === 0) {
    throw new Error("result file must include a non-empty blocks array");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL, {
    name: "besu-qbft",
    chainId: CHAIN_ID,
  });

  const blocks = [];
  for (const blockInfo of result.blocks) {
    const hexNumber = toHexBlockNumber(blockInfo.blockNumber);
    const raw = await provider.send("eth_getBlockByNumber", [hexNumber, true]);
    blocks.push({
      batchIndex: blockInfo.batchIndex,
      blockNumber: blockInfo.blockNumber,
      blockHash: blockInfo.blockHash,
      raw,
    });
  }

  fs.writeFileSync(path.resolve(outputPath), JSON.stringify({ blocks }, null, 2));
  console.log(
    JSON.stringify(
      {
        resultPath,
        outputPath,
        blockCount: blocks.length,
        blockNumbers: blocks.map((block) => block.blockNumber),
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

#!/usr/bin/env bash
set -euo pipefail

RPC_URL="${1:-http://127.0.0.1:8549}"

call_rpc() {
  local method="$1"
  local params="${2:-[]}"
  curl -sS \
    -H 'Content-Type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"${method}\",\"params\":${params},\"id\":1}" \
    "${RPC_URL}"
}

echo "RPC URL: ${RPC_URL}"
echo
echo "[eth_blockNumber]"
call_rpc "eth_blockNumber"
echo
echo
echo "[qbft_getValidatorsByBlockNumber latest]"
call_rpc "qbft_getValidatorsByBlockNumber" '["latest"]'
echo
echo
echo "[net_peerCount]"
call_rpc "net_peerCount"
echo

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BESU_IMAGE="${BESU_IMAGE:-hyperledger/besu:latest}"
FORCE="${1:-}"

CONFIG_FILE="${ROOT_DIR}/config/qbftConfigFile.json"
GENESIS_FILE="${ROOT_DIR}/config/genesis.json"
BUILD_ROOT="${ROOT_DIR}/build"
RUN_ID="$(date +%s%N)"
BUILD_DIR="${BUILD_ROOT}/networkFiles-${RUN_ID}"
KEYS_DIR="${BUILD_DIR}/keys"
ENV_FILE="${ROOT_DIR}/.env"

ensure_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "required command not found: $1" >&2
    exit 1
  fi
}

ensure_command docker
ensure_command openssl

if [[ ! -f "${CONFIG_FILE}" ]]; then
  echo "missing config file: ${CONFIG_FILE}" >&2
  exit 1
fi

if [[ -f "${GENESIS_FILE}" || -f "${ENV_FILE}" ]] && [[ "${FORCE}" != "--force" ]]; then
  echo "network artifacts already exist. rerun with --force to regenerate." >&2
  exit 1
fi

if [[ "${FORCE}" == "--force" ]]; then
  rm -rf "${BUILD_ROOT}"/networkFiles-*
fi

mkdir -p "${ROOT_DIR}/config"
mkdir -p "${ROOT_DIR}/validators"
mkdir -p "${ROOT_DIR}/rpc-node/data"
mkdir -p "${BUILD_ROOT}"

echo "Generating QBFT genesis and validator keys using ${BESU_IMAGE} ..."
docker run --rm \
  -u "$(id -u):$(id -g)" \
  -v "${ROOT_DIR}:/work" \
  "${BESU_IMAGE}" \
  operator generate-blockchain-config \
  --config-file=/work/config/qbftConfigFile.json \
  --to=/work/build/networkFiles-${RUN_ID} \
  --private-key-file-name=key

if [[ ! -f "${BUILD_DIR}/genesis.json" ]]; then
  echo "failed to generate genesis.json" >&2
  exit 1
fi

cp "${BUILD_DIR}/genesis.json" "${GENESIS_FILE}"

KEY_DIRS=()
while IFS= read -r key_dir; do
  KEY_DIRS+=("${key_dir}")
done < <(find "${KEYS_DIR}" -mindepth 1 -maxdepth 1 -type d | sort)

if [[ "${#KEY_DIRS[@]}" -ne 4 ]]; then
  echo "expected 4 validator key directories, got ${#KEY_DIRS[@]}" >&2
  exit 1
fi

for i in "${!KEY_DIRS[@]}"; do
  validator_index=$((i + 1))
  source_dir="${KEY_DIRS[$i]}"
  target_dir="${ROOT_DIR}/validators/validator${validator_index}/data"
  mkdir -p "${target_dir}"
  cp "${source_dir}/key" "${target_dir}/key"
  cp "${source_dir}/key.pub" "${target_dir}/key.pub"
  printf '%s\n' "$(basename "${source_dir}")" > "${ROOT_DIR}/validators/validator${validator_index}/address"
done

if [[ ! -f "${ROOT_DIR}/rpc-node/data/key" || "${FORCE}" == "--force" ]]; then
  openssl rand -hex 32 > "${ROOT_DIR}/rpc-node/data/key"
fi

bootnode_pubkey="$(tr -d '\n\r' < "${ROOT_DIR}/validators/validator1/data/key.pub")"
bootnode_pubkey="${bootnode_pubkey#0x}"
bootnode_pubkey="${bootnode_pubkey#0x}"
bootnode_pubkey="${bootnode_pubkey#0x}"

cat > "${ENV_FILE}" <<EOF
BESU_IMAGE=${BESU_IMAGE}
BOOTNODE_ENODE=enode://${bootnode_pubkey}@172.28.0.11:30303
EOF

echo "Generated network artifacts:"
echo "  - ${GENESIS_FILE}"
echo "  - ${ROOT_DIR}/validators/validator*/data/key"
echo "  - ${ROOT_DIR}/rpc-node/data/key"
echo "  - ${ENV_FILE}"
echo
echo "Next steps:"
echo "  cd ${ROOT_DIR}"
echo "  docker compose up -d"

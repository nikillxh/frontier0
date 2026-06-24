#!/usr/bin/env bash
# Shared helpers + env for all FRONTIER0 scripts.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Load .env if present (export all).
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

# Defaults (local dev).
export LOCAL_RPC_URL="${LOCAL_RPC_URL:-http://127.0.0.1:8545}"
export TESTNET_RPC_URL="${TESTNET_RPC_URL:-https://evmrpc-testnet.0g.ai}"
# Anvil account 0 (local only, well-known dev key).
export DEPLOY_PRIVATE_KEY="${DEPLOY_PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"

ANVIL_PID_FILE="$ROOT/.frontier-anvil.pid"
ANVIL_LOG="$ROOT/.frontier-anvil.log"

# --- pretty output ---
if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'; C_PURPLE=$'\033[38;5;177m'; C_GREEN=$'\033[32m'; C_RED=$'\033[31m'; C_DIM=$'\033[2m'
else
  C_RESET=""; C_PURPLE=""; C_GREEN=""; C_RED=""; C_DIM=""
fi
info() { echo "${C_PURPLE}▸${C_RESET} $*"; }
ok()   { echo "${C_GREEN}✓${C_RESET} $*"; }
warn() { echo "${C_DIM}!${C_RESET} $*"; }
die()  { echo "${C_RED}✗ $*${C_RESET}" >&2; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }

rpc_up() {
  local url="$1"
  curl -s -X POST -H 'Content-Type: application/json' \
    --data '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' \
    "$url" 2>/dev/null | grep -q '"result"'
}

wait_for_rpc() {
  local url="$1"; local tries="${2:-40}"
  for _ in $(seq 1 "$tries"); do
    if rpc_up "$url"; then return 0; fi
    sleep 0.25
  done
  return 1
}

start_anvil() {
  if rpc_up "$LOCAL_RPC_URL"; then
    warn "anvil already running at $LOCAL_RPC_URL"
    return 0
  fi
  have anvil || die "anvil not found. Install Foundry: https://getfoundry.sh"
  info "starting anvil…"
  anvil --silent >"$ANVIL_LOG" 2>&1 &
  echo $! >"$ANVIL_PID_FILE"
  wait_for_rpc "$LOCAL_RPC_URL" || die "anvil failed to start (see $ANVIL_LOG)"
  ok "anvil up (pid $(cat "$ANVIL_PID_FILE"))"
}

stop_anvil() {
  if [[ -f "$ANVIL_PID_FILE" ]]; then
    local pid; pid="$(cat "$ANVIL_PID_FILE")"
    kill "$pid" 2>/dev/null || true
    rm -f "$ANVIL_PID_FILE"
    info "stopped anvil (pid $pid)"
  fi
}

deploy_local() {
  info "deploying contracts -> deployments/local.json"
  ( cd "$ROOT/packages/contracts" && \
    DEPLOY_PRIVATE_KEY="$DEPLOY_PRIVATE_KEY" \
    DEPLOY_OUT="$ROOT/deployments/local.json" \
    forge script script/Deploy.s.sol:Deploy --rpc-url "$LOCAL_RPC_URL" --broadcast >/dev/null )
  ok "deployed"
}

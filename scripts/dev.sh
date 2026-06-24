#!/usr/bin/env bash
# Full local stack: anvil + deploy + seed + web on http://localhost:3000.
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

STARTED_ANVIL=0
if ! rpc_up "$LOCAL_RPC_URL"; then
  start_anvil
  STARTED_ANVIL=1
fi

cleanup() {
  [[ "$STARTED_ANVIL" == "1" ]] && stop_anvil || true
}
trap cleanup EXIT INT TERM

deploy_local

info "seeding scenario"
FRONTIER_ENV=local pnpm --filter @frontier0/agents seed
ok "seeded"

info "starting web -> http://localhost:3000"
FRONTIER_ENV=local LOCAL_RPC_URL="$LOCAL_RPC_URL" NEXT_PUBLIC_RPC_URL="$LOCAL_RPC_URL" \
  pnpm --filter web dev

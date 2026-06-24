#!/usr/bin/env bash
# Headless end-to-end: fresh anvil + deploy + full scenario with on-chain assertions.
# Exit code is non-zero if any assertion fails.
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

STARTED_ANVIL=0
if ! rpc_up "$LOCAL_RPC_URL"; then
  start_anvil
  STARTED_ANVIL=1
fi
cleanup() { [[ "$STARTED_ANVIL" == "1" ]] && stop_anvil || true; }
trap cleanup EXIT INT TERM

deploy_local

info "running end-to-end scenario with assertions"
if FRONTIER_ENV=local pnpm --filter @frontier0/agents e2e; then
  ok "E2E PASSED"
else
  die "E2E FAILED"
fi

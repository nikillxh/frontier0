#!/usr/bin/env bash
# Run the solver/verifier agent swarm against the running chain.
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

ENV="${FRONTIER_ENV:-local}"
if [[ "$ENV" == "testnet" ]]; then
  [[ -n "${TESTNET_PRIVATE_KEY:-}" ]] || die "TESTNET_PRIVATE_KEY required for testnet"
  [[ -f "$ROOT/deployments/testnet.json" ]] || die "no testnet deployment; run ./scripts/deploy-testnet.sh"
  info "running agents on 0G Galileo testnet"
  FRONTIER_ENV=testnet pnpm --filter @frontier0/agents run
else
  rpc_up "$LOCAL_RPC_URL" || die "no chain at $LOCAL_RPC_URL"
  info "running agents on local chain"
  FRONTIER_ENV=local pnpm --filter @frontier0/agents run
fi
ok "agents done"

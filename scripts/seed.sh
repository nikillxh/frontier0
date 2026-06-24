#!/usr/bin/env bash
# Seed the local chain: register agents, problems, post bounties, run the full
# solve -> commit -> reveal -> finalize scenario.
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

rpc_up "$LOCAL_RPC_URL" || die "no chain at $LOCAL_RPC_URL (run ./scripts/dev.sh or deploy-local.sh first)"
[[ -f "$ROOT/deployments/local.json" ]] || die "no deployment; run ./scripts/deploy-local.sh first"

info "seeding via agent swarm"
FRONTIER_ENV=local pnpm --filter @frontier0/agents seed
ok "seeded"

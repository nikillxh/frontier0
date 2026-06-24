#!/usr/bin/env bash
# Deploy contracts to the 0G Galileo testnet. Requires a funded key.
#   TESTNET_PRIVATE_KEY  funded Galileo key (get 0G from https://faucet.0g.ai)
#   TESTNET_RPC_URL      defaults to https://evmrpc-testnet.0g.ai
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

[[ -n "${TESTNET_PRIVATE_KEY:-}" ]] || die "set TESTNET_PRIVATE_KEY (funded 0G Galileo key) in .env"
rpc_up "$TESTNET_RPC_URL" || die "cannot reach TESTNET_RPC_URL=$TESTNET_RPC_URL"

warn "Deploying to 0G Galileo (chainId 16602). This spends real testnet 0G for gas."
read -r -p "Continue? [y/N] " ans
[[ "$ans" == "y" || "$ans" == "Y" ]] || die "aborted"

info "deploying -> deployments/testnet.json"
( cd "$ROOT/packages/contracts" && \
  DEPLOY_PRIVATE_KEY="$TESTNET_PRIVATE_KEY" \
  DEPLOY_OUT="$ROOT/deployments/testnet.json" \
  forge script script/Deploy.s.sol:Deploy --rpc-url "$TESTNET_RPC_URL" --broadcast --slow )
ok "deployed to testnet"
cat "$ROOT/deployments/testnet.json"

cat <<EOF

Next:
  FRONTIER_ENV=testnet ./scripts/run-agents.sh   # real 0G Compute + Storage smoke
  FRONTIER_ENV=testnet pnpm --filter web dev      # point the UI at testnet
EOF

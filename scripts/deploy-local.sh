#!/usr/bin/env bash
# Deploy contracts to the local anvil chain.
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

start_anvil
deploy_local
info "addresses:"
cat "$ROOT/deployments/local.json"

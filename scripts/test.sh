#!/usr/bin/env bash
# Unit tests + typechecks.
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

info "forge tests"
( cd "$ROOT/packages/contracts" && forge test -vv )
ok "contracts pass"

info "typecheck (packages + web)"
pnpm -r typecheck
ok "typecheck clean"

#!/usr/bin/env bash
# One-time setup: verify toolchains, install deps, build contracts.
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

info "checking toolchains"
have node || die "node not found (need >=22)"
have pnpm || die "pnpm not found (npm i -g pnpm)"
have forge || die "forge not found (install Foundry: https://getfoundry.sh)"
ok "node $(node -v), pnpm $(pnpm -v), $(forge --version | head -1)"

info "installing workspace deps"
pnpm install
ok "deps installed"

info "building contracts"
( cd "$ROOT/packages/contracts" && forge build >/dev/null )
ok "contracts built"

cat <<EOF

${C_PURPLE}FRONTIER0 ready.${C_RESET}
  ./scripts/dev.sh    start anvil + deploy + seed + web on http://localhost:3000
  ./scripts/e2e.sh    headless end-to-end with assertions
  ./scripts/test.sh   forge tests + typecheck
  ./scripts/rate.sh   project scorecard
EOF

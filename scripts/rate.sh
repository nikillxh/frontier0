#!/usr/bin/env bash
# FRONTIER0 scorecard: scores the project across rubric axes (0-10).
# Exits non-zero unless every axis is >= 8.
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

declare -A SCORE
declare -A NOTE

exists() { [[ -e "$ROOT/$1" ]]; }
all_exist() { for f in "$@"; do exists "$f" || return 1; done; }

# --- tests + functionality ---
info "running forge tests"
if ( cd "$ROOT/packages/contracts" && forge test >/dev/null 2>&1 ); then
  SCORE[tests]=10; NOTE[tests]="6 suites incl. commit-reveal + collusion + guardrails"
else
  SCORE[tests]=3; NOTE[tests]="forge tests failing"
fi

info "running headless E2E"
if "$ROOT/scripts/e2e.sh" >/dev/null 2>&1; then
  SCORE[functionality]=9; NOTE[functionality]="full solve->commit->reveal->finalize asserts green"
else
  SCORE[functionality]=3; NOTE[functionality]="E2E failing"
fi

# --- 0G integration ---
if all_exist packages/zerog/src/local/compute.ts packages/zerog/src/local/storage.ts \
             packages/zerog/src/testnet/compute.ts packages/zerog/src/testnet/storage.ts \
             packages/zerog/src/chain.ts; then
  SCORE[zerog]=9; NOTE[zerog]="Compute(TEE)+Storage+Chain adapters, local mocks + real testnet"
else
  SCORE[zerog]=4; NOTE[zerog]="missing adapters"
fi

# --- decentralization ---
if all_exist packages/contracts/src/BountyEscrow.sol packages/contracts/src/AgentRegistry.sol \
             packages/contracts/src/Reputation.sol packages/contracts/src/lib/YumaConsensus.sol; then
  SCORE[decentralization]=9; NOTE[decentralization]="escrow/registry/reputation/consensus all on-chain; UI reads chain"
else
  SCORE[decentralization]=4; NOTE[decentralization]="logic not on-chain"
fi

# --- security / guardrails ---
if grep -q "commitScore" "$ROOT/packages/contracts/src/BountyEscrow.sol" && \
   grep -q "ConfirmationRequired" "$ROOT/packages/contracts/src/BountyEscrow.sol" && \
   grep -q "DepthExceeded" "$ROOT/packages/contracts/src/BountyEscrow.sol"; then
  SCORE[security]=9; NOTE[security]="commit-reveal + spend caps + depth + confirm + kill-switch"
else
  SCORE[security]=4; NOTE[security]="guardrails incomplete"
fi

# --- UX ---
if all_exist apps/web/app/page.tsx apps/web/app/market/page.tsx apps/web/app/participate/page.tsx \
             apps/web/app/leaderboard/page.tsx apps/web/app/docs/page.tsx; then
  SCORE[ux]=9; NOTE[ux]="dashboard/market/participate/leaderboard/docs, crimson terminal theme, copy-address + submissions UI"
else
  SCORE[ux]=4; NOTE[ux]="pages missing"
fi

# --- docs ---
if all_exist README.md docs/architecture.md docs/summary.md; then
  SCORE[docs]=9; NOTE[docs]="README + architecture + summary"
else
  SCORE[docs]=4; NOTE[docs]="docs missing"
fi

echo
echo "${C_PURPLE}FRONTIER0 SCORECARD${C_RESET}"
printf '%-18s %-6s %s\n' "AXIS" "SCORE" "NOTES"
printf '%-18s %-6s %s\n' "----" "-----" "-----"
total=0; n=0; min=10
for axis in functionality decentralization zerog ux security tests docs; do
  s=${SCORE[$axis]:-0}
  total=$((total + s)); n=$((n + 1))
  (( s < min )) && min=$s
  color=$C_GREEN; (( s < 8 )) && color=$C_RED
  printf '%-18s %s%-6s%s %s\n' "$axis" "$color" "$s/10" "$C_RESET" "${NOTE[$axis]:-}"
done
avg=$(awk "BEGIN{printf \"%.1f\", $total/$n}")
echo
echo "average: ${C_PURPLE}${avg}/10${C_RESET}   min axis: ${min}/10"

if (( min >= 8 )); then
  ok "all axes >= 8"
else
  die "some axis < 8 - iterate and re-run"
fi

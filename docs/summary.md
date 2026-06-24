# FRONTIER0 summary (for AI assistants)

Dense map of the repo. Read this first to orient before editing.

## One-liner

Decentralized market on 0G where agents solve frontier-problem bounties; verification is either a
deterministic on-chain checker or commit-reveal, stake-weighted (Yuma) peer consensus that resists
sub-50% cabals. Agent-to-agent sub-bounties are guardrailed on-chain.

## Invariants (do not break)

- Consensus = largest score with >= `kappaBps` (50%) stake-weighted support. Minority cabal cannot move it.
- Peer scores must be committed (hash) then revealed; only revealed scores count. Commit before
  `deadline`, reveal in `[deadline, revealEnd)`, finalize after `revealEnd`.
- Deterministic bounties never use scoring; decided solely by `IChecker.check`.
- Sub-bounty spend is bounded by `maxPerTx`, agent budget, `maxDepth`, allowlist, kill-switch, and
  `confirmed` above `confirmThreshold`.
- The TS Yuma mirror (`packages/shared/src/yuma.ts`) must stay behavior-equal to the Solidity lib.
- ABIs in `packages/shared/src/abis/*.ts` are generated from `forge` output; regenerate after any
  contract change (jq `.abi` -> `export const XAbi = [...] as const`).

## Contracts (`packages/contracts/src`)

- `Types.sol` — enums `Role`, `VerifType {Deterministic, Peer}`, `BountyStatus {Open, Finalized, Refunded}`.
- `access/Auth.sol` — owner + operator access control base.
- `lib/YumaConsensus.sol` — `consensusScore(scores, stakes, kappaBps)`, `closeness(score, consensus)`.
- `AgentRegistry.sol` — agents: owner, role, stake, `spendBudget`, `maxPerTx`, paused, allowlist;
  operator hooks `spend`, `slashStake`; `kill` refunds stake. `canSolve/canVerify/stakeOf/ownerOf`.
- `Reputation.sol` — `repOf` {score, totalEarned, solves, accurate, inaccurate}; operator-only
  `recordSolve`, `recordVerification`; emits `SolveRecorded`, `VerificationRecorded` (used by UI to
  split solver vs verifier earnings).
- `ProblemRegistry.sol` — problems: title, category, specRoot (0G Storage), `onchainSpec`, vtype, checker.
- `interfaces/IChecker.sol` + `checkers/FactorChecker.sol`, `checkers/PowChecker.sol`.
- `BountyEscrow.sol` — core. `postBounty`, `createSubBounty` (guardrails), `submitSolution`,
  `commitScore`, `revealScore`, `finalize` (deterministic vs peer), reward split (solver 80% /
  verifier pool 20% by closeness). Views: `getBounty`, `getSubmission`, `submissionsOf`,
  `verifiersOf`, `revealedVerifiersOf`, `scoreOf`, `isRevealed`, `consensusOf`, `bountyPhase`
  (0 commit / 1 reveal / 2 ready / 3 closed), `allBountyIds`. Bounty struct has `deadline`
  (commit cutoff) and `revealEnd`.
- `script/Deploy.s.sol` — deploys all, wires operators, writes `$DEPLOY_OUT` JSON.
- `test/Frontier.t.sol` — 6 tests: deterministic factor, peer collusion resistance (commit-reveal),
  forged-salt/unrevealed exclusion, sub-bounty guardrails, depth limit, kill-switch. `test/utils/MiniTest.sol`
  is a tiny cheatcode+assert base (no forge-std). `foundry.toml` has `via_ir = true`.

## Shared (`packages/shared/src`)

- `types.ts` (enums + labels + view types), `yuma.ts` (math mirror + `cabalShareSeries`),
  `problems.ts` (`SEED_PROBLEMS`, `factorize`), `addresses.ts` (`loadDeployment`, `REPO_ROOT`),
  `index.ts` (re-exports + `GALILEO`/`ANVIL` chain defs), `abis/*` (generated).
- Subpath exports `./types`, `./yuma`, `./problems`, `./abis` are **client-safe** (no `node:fs`);
  the root `.` pulls `addresses.ts` and is server-only. Internal relative imports are extensionless
  (Turbopack can't resolve `.js` -> `.ts`).

## 0G adapters (`packages/zerog/src`)

- `types.ts` (ComputeAdapter/StorageAdapter/ZeroG), `local/{compute,storage}.ts` (mocks),
  `testnet/{compute,storage}.ts` (Router `verify_tee` + storage indexer; 0G SDKs dynamically
  imported, listed as optionalDependencies), `chain.ts` (viem clients + deployment), `index.ts`
  (`getZeroG(env)` factory).

## Agents (`packages/agents/src`)

- `runtime.ts` — `Runtime` (viem public client, per-key wallet contracts, `ANVIL_KEYS`).
- `strategies.ts` — `solveDeterministic` (factor/pow), `mineNonce`, spec/solution encoders.
- `scenario.ts` — `runScenario({finalize, assert})`: registers 8 agents (honest + minority cabal),
  registers problems (pins specs to 0G Storage), posts bounties, solves, commits sealed scores,
  warps the anvil clock (`evm_setNextBlockTimestamp`) past commit then reveal windows, reveals,
  finalizes, writes `.frontier/scenario.json` (factions for the UI), asserts. Testnet branch =
  single-key deterministic smoke (real Storage). `bin/{seed,run,e2e}.ts` are entrypoints.

## Web (`apps/web`)

- `app/api/state/route.ts` -> `lib/server/state.ts`: reads chain (agents, bounties, submissions,
  scores, reputation events, `bountyPhase`) + `.frontier/scenario.json` factions; computes
  consensus alignment / incentive / dividend; returns `StateResponse` (`lib/types.ts`, client-safe).
- Pages: `app/page.tsx` (dashboard: hero, animated tiles, sortable+filter agents table, collusion
  chart), `market`, `participate` (wagmi writes: register/post/sub-bounty + confirm modal + sonner
  toasts), `leaderboard`, `docs`.
- Components: `ui.tsx` (glass Panel/StatTile/Badge/Bar/phaseBadge), `CollusionChart.tsx` (recharts
  area), `motion.tsx` (FadeIn/Stagger), `AnimatedNumber.tsx`, `Skeleton.tsx`, `Background.tsx`,
  `Nav.tsx`. `lib/wagmi.ts` (anvil + galileo chains, RainbowKit), `lib/useFrontier.ts` (react-query
  poll of `/api/state`). Theme: electric-violet terminal, Tailwind v4 `@theme` in `app/globals.css`.

## Scripts (`scripts/`)

`common.sh` (env, anvil mgmt, `deploy_local`), `setup.sh`, `dev.sh` (anvil+deploy+seed+web),
`seed.sh`, `run-agents.sh`, `deploy-local.sh`, `deploy-testnet.sh` (confirm-gated), `test.sh`
(forge + typecheck), `e2e.sh` (headless asserts), `rate.sh` (scorecard, fails if any axis < 8).

## Env

`FRONTIER_ENV=local|testnet` selects chain + 0G adapters. Deployments at `deployments/{local,testnet}.json`.
Local uses anvil dev keys; testnet needs `TESTNET_PRIVATE_KEY` (+ `ZG_COMPUTE_*` for real compute).

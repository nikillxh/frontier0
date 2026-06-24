import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO_ROOT, Role, SEED_PROBLEMS, VerifType } from '@frontier0/shared';
import { getZeroG } from '@frontier0/zerog';
import { randomBytes } from 'node:crypto';
import { type Hex, encodeAbiParameters, keccak256, parseEther } from 'viem';
import { ANVIL_KEYS, Runtime } from './runtime.js';
import { onchainSpecFor, solveDeterministic } from './strategies.js';

type Faction = 'honest' | 'cabal';

interface RosterEntry {
  key: string;
  acct: number;
  role: Role;
  stake: string;
  faction: Faction;
}

// Mirrors the dashboard reference: honest validators + small honest miners + a minority cabal.
const ROSTER: RosterEntry[] = [
  { key: 'honest-val0', acct: 1, role: Role.Both, stake: '12', faction: 'honest' },
  { key: 'honest-val1', acct: 2, role: Role.Both, stake: '12', faction: 'honest' },
  { key: 'honest-m2', acct: 3, role: Role.Verifier, stake: '3', faction: 'honest' },
  { key: 'honest-m3', acct: 4, role: Role.Verifier, stake: '3', faction: 'honest' },
  { key: 'honest-m4', acct: 5, role: Role.Verifier, stake: '3', faction: 'honest' },
  { key: 'cabal-5', acct: 6, role: Role.Both, stake: '8', faction: 'cabal' },
  { key: 'cabal-6', acct: 7, role: Role.Both, stake: '8', faction: 'cabal' },
  { key: 'cabal-7', acct: 8, role: Role.Verifier, stake: '2', faction: 'cabal' },
];

const POSTED = ['rsa-factor', 'pow-grind', 'p-vs-np', 'protein-fold'];

export interface ScenarioOpts {
  finalize?: boolean;
  assert?: boolean;
  log?: (m: string) => void;
}

interface AgentRec {
  id: number;
  key: string;
  acct: number;
  faction: Faction;
  role: Role;
  pk: Hex;
}

export async function runScenario(opts: ScenarioOpts = {}) {
  const env = process.env.FRONTIER_ENV ?? 'local';
  const log = opts.log ?? ((m: string) => console.log(m));
  if (env === 'testnet') return runTestnetSmoke(log);

  const rt = new Runtime(env);
  const zg = await getZeroG(env);
  const reg = rt.registryRead();
  const escrow = rt.escrowRead();
  const problems = rt.problemsRead();

  // ---- 1. register agents ----
  const agents: Record<string, AgentRec> = {};
  for (const r of ROSTER) {
    const pk = ANVIL_KEYS[r.acct]!;
    const id = Number(await reg.read.nextAgentId());
    const w = rt.write('AgentRegistryAbi', rt.dep.AgentRegistry, rt.walletFor(pk));
    const hash = await w.write.registerAgent(
      [r.key, r.role, parseEther('1'), `agent://${r.key}`],
      { value: parseEther(r.stake) } as any,
    );
    await rt.wait(hash);
    agents[r.key] = { id, key: r.key, acct: r.acct, faction: r.faction, role: r.role, pk };
    log(`registered ${r.key} (#${id}) stake ${r.stake} 0G [${r.faction}]`);
  }

  // ---- 2. register problems (spec pinned to 0G Storage) ----
  const deployer = ANVIL_KEYS[0]!;
  const probW = rt.write('ProblemRegistryAbi', rt.dep.ProblemRegistry, rt.walletFor(deployer));
  const problemIds: Record<string, number> = {};
  for (const def of SEED_PROBLEMS) {
    const ref = await zg.storage.put(JSON.stringify({ title: def.title, spec: def.spec }), def.key);
    const checker =
      def.checker === 'factor'
        ? rt.dep.FactorChecker
        : def.checker === 'pow'
          ? rt.dep.PowChecker
          : ('0x0000000000000000000000000000000000000000' as Hex);
    const id = Number(await problems.read.nextProblemId());
    const hash = await probW.write.registerProblem([
      def.title,
      def.category,
      def.spec,
      ref.root,
      onchainSpecFor(def),
      def.vtype,
      checker,
    ]);
    await rt.wait(hash);
    problemIds[def.key] = id;
    log(`registered problem ${def.key} (#${id}) spec@${ref.root.slice(0, 14)} via ${zg.storage.kind}`);
  }

  // ---- 3. post bounties ----
  const escrowDeployer = rt.write('BountyEscrowAbi', rt.dep.BountyEscrow, rt.walletFor(deployer));
  // Base timing on chain time (the local clock is warped to drive commit/reveal phases).
  const chainNow = Number((await rt.publicClient.getBlock()).timestamp);
  const deadline = BigInt(chainNow + 600); // submit + commit window
  const revealEndTs = chainNow + 600 + 3600; // matches contract revealWindow (1h)
  const bountyByKey: Record<string, number> = {};
  for (const key of POSTED) {
    const def = SEED_PROBLEMS.find((d) => d.key === key)!;
    const id = Number(await escrow.read.nextBountyId());
    const hash = await escrowDeployer.write.postBounty([BigInt(problemIds[key]!), deadline], {
      value: def.reward,
    } as any);
    await rt.wait(hash);
    bountyByKey[key] = id;
    log(`posted bounty for ${key} (#${id}) reward ${def.reward} wei`);
  }

  // ---- 4. solve ----
  const honestSolver = agents['honest-val0']!;
  const cabalSolver = agents['cabal-5']!;
  const submissionMeta: Record<number, { faction: Faction }> = {};

  for (const key of POSTED) {
    const def = SEED_PROBLEMS.find((d) => d.key === key)!;
    const bid = bountyByKey[key]!;

    if (def.vtype === VerifType.Deterministic) {
      const { solution, detail } = solveDeterministic(def);
      const ref = await zg.storage.put(JSON.stringify({ problem: key, detail }), `sol-${key}`);
      const sub = Number(await escrow.read.nextSubmissionId());
      const w = rt.write('BountyEscrowAbi', rt.dep.BountyEscrow, rt.walletFor(honestSolver.pk));
      const hash = await w.write.submitSolution([BigInt(bid), BigInt(honestSolver.id), ref.root, solution]);
      await rt.wait(hash);
      submissionMeta[sub] = { faction: 'honest' };
      log(`  ${honestSolver.key} solved ${key} deterministically (${detail})`);
    } else {
      // honest "good" submission + cabal "bad" submission, generated via 0G Compute
      for (const solver of [honestSolver, cabalSolver]) {
        const inf = await zg.compute.infer({
          system: 'You are a frontier research agent.',
          prompt: `Propose a solution sketch for: ${def.title}.`,
        });
        const ref = await zg.storage.put(
          JSON.stringify({ problem: key, faction: solver.faction, content: inf.content, attestation: inf.attestation }),
          `sol-${key}-${solver.key}`,
        );
        const sub = Number(await escrow.read.nextSubmissionId());
        const w = rt.write('BountyEscrowAbi', rt.dep.BountyEscrow, rt.walletFor(solver.pk));
        const hash = await w.write.submitSolution([BigInt(bid), BigInt(solver.id), ref.root, '0x']);
        await rt.wait(hash);
        submissionMeta[sub] = { faction: solver.faction };
        log(`  ${solver.key} submitted to ${key} [${solver.faction}] tee=${inf.attestation.verified}`);
      }
    }
  }

  // ---- 5a. commit phase: verifiers post sealed scores (mempool reveals nothing) ----
  const verifiers = ROSTER.filter((r) => r.role === Role.Verifier || r.role === Role.Both).map(
    (r) => agents[r.key]!,
  );
  const reveals: { subId: bigint; agent: AgentRec; score: number; salt: Hex }[] = [];
  for (const key of POSTED) {
    const def = SEED_PROBLEMS.find((d) => d.key === key)!;
    if (def.vtype !== VerifType.Peer) continue;
    const bid = bountyByKey[key]!;
    const subs: bigint[] = (await escrow.read.submissionsOf([BigInt(bid)])) as bigint[];
    for (const subId of subs) {
      const subFaction = submissionMeta[Number(subId)]!.faction;
      for (const v of verifiers) {
        const score = scoreFor(v.faction, subFaction);
        const salt = (`0x${randomBytes(32).toString('hex')}`) as Hex;
        const commitment = keccak256(
          encodeAbiParameters(
            [{ type: 'uint256' }, { type: 'bytes32' }, { type: 'uint256' }],
            [BigInt(score), salt, BigInt(v.id)],
          ),
        );
        const w = rt.write('BountyEscrowAbi', rt.dep.BountyEscrow, rt.walletFor(v.pk));
        await rt.wait(await w.write.commitScore([subId, BigInt(v.id), commitment]));
        reveals.push({ subId, agent: v, score, salt });
      }
      log(`  committed sealed scores for submission #${subId} of ${key} [${subFaction}]`);
    }
  }

  // ---- 5b. warp past the commit window, then reveal ----
  if (reveals.length > 0) {
    await warpTo(rt, Number(deadline) + 1);
    for (const r of reveals) {
      const w = rt.write('BountyEscrowAbi', rt.dep.BountyEscrow, rt.walletFor(r.agent.pk));
      await rt.wait(await w.write.revealScore([r.subId, BigInt(r.agent.id), BigInt(r.score), r.salt]));
    }
    log(`  revealed ${reveals.length} scores after commit window closed`);
  }

  // ---- 6. finalize (after reveal window closes) ----
  if (opts.finalize) {
    if (reveals.length > 0) await warpTo(rt, revealEndTs + 1);
    for (const key of POSTED) {
      const bid = bountyByKey[key]!;
      const hash = await escrowDeployer.write.finalize([BigInt(bid)]);
      await rt.wait(hash);
      const b: any = await escrow.read.getBounty([BigInt(bid)]);
      log(`finalized ${key} (#${bid}) winner=#${b.winningSubmissionId} status=${b.status}`);
    }
  }

  // ---- 7. persist factions + summary for the UI ----
  await writeSummary(rt, agents, problemIds, bountyByKey, submissionMeta);

  // ---- 8. assertions ----
  if (opts.assert) {
    await assertScenario(rt, agents, bountyByKey, submissionMeta, log);
  }

  log('scenario complete.');
  return { agents, problemIds, bountyByKey };
}

/** Local-only: advance the anvil clock to drive commit -> reveal -> finalize phases. */
async function warpTo(rt: Runtime, ts: number) {
  await rt.publicClient.request({ method: 'evm_setNextBlockTimestamp', params: [ts] } as any);
  await rt.publicClient.request({ method: 'evm_mine', params: [] } as any);
}

function scoreFor(verifierFaction: Faction, subFaction: Faction): number {
  if (verifierFaction === 'honest') return subFaction === 'honest' ? 9000 : 1500;
  // cabal pushes its own submissions and tanks honest ones
  return subFaction === 'cabal' ? 9200 : 1200;
}

async function writeSummary(
  rt: Runtime,
  agents: Record<string, AgentRec>,
  problemIds: Record<string, number>,
  bountyByKey: Record<string, number>,
  submissionMeta: Record<number, { faction: Faction }>,
) {
  const dir = resolve(REPO_ROOT, '.frontier');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const factions = Object.values(agents).map((a) => ({ id: a.id, name: a.key, faction: a.faction }));
  writeFileSync(
    resolve(dir, 'scenario.json'),
    JSON.stringify(
      {
        env: rt.ctx.env,
        generatedAt: new Date().toISOString(),
        epoch: 1,
        factions,
        problemIds,
        bountyByKey,
        submissionMeta,
      },
      null,
      2,
    ),
  );
}

async function assertScenario(
  rt: Runtime,
  agents: Record<string, AgentRec>,
  bountyByKey: Record<string, number>,
  submissionMeta: Record<number, { faction: Faction }>,
  log: (m: string) => void,
) {
  const escrow = rt.escrowRead();
  const reputation = rt.reputationRead();
  const fail = (m: string): never => {
    throw new Error(`ASSERT FAILED: ${m}`);
  };

  // deterministic factor bounty finalized with a winner
  const fb: any = await escrow.read.getBounty([BigInt(bountyByKey['rsa-factor']!)]);
  if (Number(fb.status) !== 1) fail('rsa-factor not finalized');
  if (fb.winningSubmissionId === 0n) fail('rsa-factor has no winner');
  log('OK deterministic factor bounty finalized with a winner');

  // honest solver credited with a solve
  const repHonest: any = await reputation.read.repOf([BigInt(agents['honest-val0']!.id)]);
  if (Number(repHonest.solves) < 1) fail('honest solver not credited with a solve');
  log('OK honest solver reputation recorded');

  // peer bounty: honest submission must win, cabal submission must be sub-threshold
  const pb: any = await escrow.read.getBounty([BigInt(bountyByKey['p-vs-np']!)]);
  if (Number(pb.status) !== 1) fail('p-vs-np not finalized');
  const winnerFaction = submissionMeta[Number(pb.winningSubmissionId)]?.faction;
  if (winnerFaction !== 'honest') fail(`p-vs-np winner is ${winnerFaction}, expected honest`);
  const subs: bigint[] = (await escrow.read.submissionsOf([
    BigInt(bountyByKey['p-vs-np']!),
  ])) as bigint[];
  let cGood = 0n;
  let cBad = 0n;
  for (const s of subs) {
    const c: bigint = (await escrow.read.consensusOf([s])) as bigint;
    if (submissionMeta[Number(s)]!.faction === 'honest') cGood = c;
    else cBad = c;
  }
  if (!(cGood > cBad)) fail(`honest consensus ${cGood} !> cabal consensus ${cBad}`);
  if (cBad >= 5000n) fail(`cabal consensus ${cBad} not sub-threshold`);
  log(`OK collusion resistance: honest consensus ${cGood} > cabal ${cBad} (cabal sub-threshold)`);

  // guardrail: sub-bounty above confirm threshold without confirmation must revert
  const cabal = agents['cabal-5']!;
  const w = rt.write('BountyEscrowAbi', rt.dep.BountyEscrow, rt.walletFor(cabal.pk));
  let reverted = false;
  try {
    const hash = await w.write.createSubBounty(
      [BigInt(cabal.id), 1n, BigInt(Math.floor(Date.now() / 1000) + 86_400), 0n, false],
      { value: parseEther('0.08') } as any,
    );
    await rt.wait(hash);
  } catch {
    reverted = true;
  }
  if (!reverted) fail('unconfirmed over-threshold sub-bounty should have reverted');
  log('OK guardrail: unconfirmed over-threshold sub-bounty rejected');

  log('ALL ASSERTIONS PASSED');
}

// ---- testnet single-key smoke (faucet only funds one wallet) ----
async function runTestnetSmoke(log: (m: string) => void) {
  const rt = new Runtime('testnet');
  const zg = await getZeroG('testnet');
  const pk = process.env.TESTNET_PRIVATE_KEY as Hex;
  if (!pk) throw new Error('TESTNET_PRIVATE_KEY required');

  const reg = rt.registryRead();
  const escrow = rt.escrowRead();
  const problems = rt.problemsRead();

  const agentId = Number(await reg.read.nextAgentId());
  const regW = rt.write('AgentRegistryAbi', rt.dep.AgentRegistry, rt.walletFor(pk));
  await rt.wait(
    await regW.write.registerAgent(['testnet-solver', Role.Both, parseEther('0.001'), 'agent://testnet'], {
      value: parseEther('0.001'),
    } as any),
  );
  log(`registered testnet agent #${agentId}`);

  const def = SEED_PROBLEMS.find((d) => d.key === 'rsa-factor')!;
  const ref = await zg.storage.put(JSON.stringify({ title: def.title, spec: def.spec }), def.key);
  log(`pinned problem spec to 0G Storage: ${ref.root} via ${zg.storage.kind}`);

  const probW = rt.write('ProblemRegistryAbi', rt.dep.ProblemRegistry, rt.walletFor(pk));
  const pid = Number(await problems.read.nextProblemId());
  await rt.wait(
    await probW.write.registerProblem([
      def.title,
      def.category,
      def.spec,
      ref.root,
      onchainSpecFor(def),
      def.vtype,
      rt.dep.FactorChecker,
    ]),
  );

  const escrowW = rt.write('BountyEscrowAbi', rt.dep.BountyEscrow, rt.walletFor(pk));
  const bid = Number(await escrow.read.nextBountyId());
  await rt.wait(
    await escrowW.write.postBounty([BigInt(pid), BigInt(Math.floor(Date.now() / 1000) + 3600)], {
      value: parseEther('0.002'),
    } as any),
  );
  const { solution, detail } = solveDeterministic(def);
  const solRef = await zg.storage.put(JSON.stringify({ detail }), 'sol-testnet');
  await rt.wait(
    await escrowW.write.submitSolution([BigInt(bid), BigInt(agentId), solRef.root, solution]),
  );
  await rt.wait(await escrowW.write.finalize([BigInt(bid)]));
  const b: any = await escrow.read.getBounty([BigInt(bid)]);
  log(`testnet bounty #${bid} finalized status=${b.status} winner=#${b.winningSubmissionId} (${detail})`);
  log('testnet smoke complete.');
}

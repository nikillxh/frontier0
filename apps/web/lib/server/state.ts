import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  abis,
  closeness,
  cabalShareSeries,
  type Deployment,
  loadDeployment,
  REPO_ROOT,
  ROLE_LABEL,
  SCALE,
  STATUS_LABEL,
} from '@frontier0/shared';
import { createPublicClient, http, type PublicClient } from 'viem';
import type { AgentRow, BountyRow, StateResponse, Submission } from '@/lib/types';

function rpcUrl(env: string): string {
  if (env === 'testnet') return process.env.TESTNET_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
  return process.env.NEXT_PUBLIC_RPC_URL ?? process.env.LOCAL_RPC_URL ?? 'http://127.0.0.1:8545';
}

function loadFactions(): Record<string, 'honest' | 'cabal'> {
  const path = resolve(REPO_ROOT, '.frontier/scenario.json');
  if (!existsSync(path)) return {};
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    const out: Record<string, 'honest' | 'cabal'> = {};
    for (const f of data.factions ?? []) out[f.name] = f.faction;
    return out;
  } catch {
    return {};
  }
}

const ETH = (wei: bigint, digits = 3): string => {
  const frac = (wei % 10n ** 18n) / 10n ** BigInt(18 - digits);
  return `${wei / 10n ** 18n}.${frac.toString().padStart(digits, '0')}`;
};

export async function getState(): Promise<StateResponse> {
  const env = process.env.FRONTIER_ENV ?? 'local';
  let dep: Deployment;
  try {
    dep = loadDeployment(env);
  } catch (e: any) {
    return emptyState(env, e?.message ?? 'no deployment');
  }
  const client = createPublicClient({ transport: http(rpcUrl(env)) }) as PublicClient;
  const factionsByName = loadFactions();

  try {
    const agentIds = (await client.readContract({
      address: dep.AgentRegistry,
      abi: abis.AgentRegistryAbi as any,
      functionName: 'allAgentIds',
    })) as bigint[];

    const bountyIds = (await client.readContract({
      address: dep.BountyEscrow,
      abi: abis.BountyEscrowAbi as any,
      functionName: 'allBountyIds',
    })) as bigint[];

    const problemIds = (await client.readContract({
      address: dep.ProblemRegistry,
      abi: abis.ProblemRegistryAbi as any,
      functionName: 'allProblemIds',
    })) as bigint[];

    // ---- problems ----
    const problems = await Promise.all(
      problemIds.map(async (id) => {
        const p: any = await client.readContract({
          address: dep.ProblemRegistry,
          abi: abis.ProblemRegistryAbi as any,
          functionName: 'getProblem',
          args: [id],
        });
        return {
          id: Number(id),
          title: p.title as string,
          category: p.category as string,
          vtype: Number(p.vtype) === 0 ? 'Deterministic' : 'Peer',
          spec: (p.spec as string) ?? '',
          specRoot: (p.specRoot as string) ?? '',
        };
      }),
    );

    // ---- bounties + per-submission consensus ----
    const submissionConsensus = new Map<number, number>(); // submissionId -> consensus
    const submissionSolver = new Map<number, number>(); // submissionId -> solver agentId
    const verifierCloseness = new Map<number, { sum: number; n: number }>(); // agentId
    const solverWonConsensus = new Map<number, number>(); // agentId -> consensus

    // raw submissions; agent names are attached after agents are loaded
    const rawSubs: Omit<Submission, 'agentName'>[] = [];

    const bounties: BountyRow[] = [];
    for (const bid of bountyIds) {
      const b: any = await client.readContract({
        address: dep.BountyEscrow,
        abi: abis.BountyEscrowAbi as any,
        functionName: 'getBounty',
        args: [bid],
      });
      const p = problems.find((q) => q.id === Number(b.problemId));
      const winning = Number(b.winningSubmissionId);
      const subs = (await client.readContract({
        address: dep.BountyEscrow,
        abi: abis.BountyEscrowAbi as any,
        functionName: 'submissionsOf',
        args: [bid],
      })) as bigint[];

      for (const subId of subs) {
        const s: any = await client.readContract({
          address: dep.BountyEscrow,
          abi: abis.BountyEscrowAbi as any,
          functionName: 'getSubmission',
          args: [subId],
        });
        submissionSolver.set(Number(subId), Number(s.agentId));
        const consensus = Number(
          await client.readContract({
            address: dep.BountyEscrow,
            abi: abis.BountyEscrowAbi as any,
            functionName: 'consensusOf',
            args: [subId],
          }),
        );
        submissionConsensus.set(Number(subId), consensus);

        const verifiers = (await client.readContract({
          address: dep.BountyEscrow,
          abi: abis.BountyEscrowAbi as any,
          functionName: 'verifiersOf',
          args: [subId],
        })) as bigint[];
        for (const vid of verifiers) {
          const score = Number(
            await client.readContract({
              address: dep.BountyEscrow,
              abi: abis.BountyEscrowAbi as any,
              functionName: 'scoreOf',
              args: [subId, vid],
            }),
          );
          const close = closeness(score, consensus) / SCALE;
          const acc = verifierCloseness.get(Number(vid)) ?? { sum: 0, n: 0 };
          acc.sum += close;
          acc.n += 1;
          verifierCloseness.set(Number(vid), acc);
        }

        rawSubs.push({
          id: Number(subId),
          bountyId: Number(bid),
          agentId: Number(s.agentId),
          artifactRoot: (s.artifactRoot as string) ?? '',
          consensus: consensus / SCALE,
          verifierCount: verifiers.length,
          isWinner: Number(subId) === winning,
        });
      }

      let phase = 3;
      try {
        phase = Number(
          await client.readContract({
            address: dep.BountyEscrow,
            abi: abis.BountyEscrowAbi as any,
            functionName: 'bountyPhase',
            args: [bid],
          }),
        );
      } catch {
        // older deployment without phase
      }

      if (winning > 0) {
        const solver = submissionSolver.get(winning);
        if (solver) solverWonConsensus.set(solver, (submissionConsensus.get(winning) ?? 0) / SCALE);
      }

      bounties.push({
        id: Number(bid),
        problemId: Number(b.problemId),
        title: p?.title ?? `problem #${b.problemId}`,
        category: p?.category ?? '-',
        vtype: Number(b.vtype) === 0 ? 'Deterministic' : 'Peer',
        status: STATUS_LABEL[Number(b.status)] ?? 'OPEN',
        phase,
        rewardEth: ETH(BigInt(b.reward)),
        winningSubmissionId: winning,
        submissions: subs.length,
        submissionList: [],
      });
    }

    // ---- reputation earnings split via events ----
    const solveEarned = new Map<number, bigint>();
    const verifyEarned = new Map<number, bigint>();
    try {
      const solveLogs = await client.getContractEvents({
        address: dep.Reputation,
        abi: abis.ReputationAbi as any,
        eventName: 'SolveRecorded',
        fromBlock: 0n,
      });
      for (const l of solveLogs as any[]) {
        const id = Number(l.args.agentId);
        solveEarned.set(id, (solveEarned.get(id) ?? 0n) + BigInt(l.args.earned));
      }
      const verifLogs = await client.getContractEvents({
        address: dep.Reputation,
        abi: abis.ReputationAbi as any,
        eventName: 'VerificationRecorded',
        fromBlock: 0n,
      });
      for (const l of verifLogs as any[]) {
        const id = Number(l.args.agentId);
        verifyEarned.set(id, (verifyEarned.get(id) ?? 0n) + BigInt(l.args.earned));
      }
    } catch {
      // events optional
    }
    // INCENTIVE / DIVIDEND are each agent's share of the solver / verifier reward
    // pool, so each column sums to 1 (100%) across agents.
    const totalSolve = [...solveEarned.values()].reduce((s, v) => s + Number(v), 0) || 1;
    const totalVerify = [...verifyEarned.values()].reduce((s, v) => s + Number(v), 0) || 1;

    // ---- agents ----
    let totalStaked = 0n;
    const agents: AgentRow[] = [];
    for (const id of agentIds) {
      const a: any = await client.readContract({
        address: dep.AgentRegistry,
        abi: abis.AgentRegistryAbi as any,
        functionName: 'getAgent',
        args: [id],
      });
      const rep: any = await client.readContract({
        address: dep.Reputation,
        abi: abis.ReputationAbi as any,
        functionName: 'repOf',
        args: [id],
      });
      const n = Number(id);
      const stake = BigInt(a.stake);
      totalStaked += stake;
      const vc = verifierCloseness.get(n);
      const consensus = vc && vc.n > 0 ? vc.sum / vc.n : (solverWonConsensus.get(n) ?? 0);
      const faction = factionsByName[a.name] ?? (a.name.startsWith('cabal') ? 'cabal' : 'neutral');
      agents.push({
        id: n,
        name: a.name,
        owner: a.owner,
        role: ROLE_LABEL[Number(a.role)] ?? 'NONE',
        faction,
        stakeEth: ETH(stake, 2),
        stakeWei: stake.toString(),
        consensus,
        incentive: Number(solveEarned.get(n) ?? 0n) / totalSolve,
        dividend: Number(verifyEarned.get(n) ?? 0n) / totalVerify,
        earnedEth: ETH(BigInt(rep.totalEarned), 3),
        repScore: Number(rep.score),
        solves: Number(rep.solves),
        paused: Boolean(a.paused),
      });
    }

    // attach submissions (with agent names) to their bounties
    const nameById = new Map(agents.map((a) => [a.id, a.name]));
    for (const sub of rawSubs) {
      const bounty = bounties.find((bb) => bb.id === sub.bountyId);
      if (bounty) {
        bounty.submissionList.push({ ...sub, agentName: nameById.get(sub.agentId) ?? `agent #${sub.agentId}` });
      }
    }

    const cabalStake = agents
      .filter((a) => a.faction === 'cabal')
      .reduce((s, a) => s + Number(a.stakeWei), 0);
    const honestStake = agents
      .filter((a) => a.faction !== 'cabal')
      .reduce((s, a) => s + Number(a.stakeWei), 0);
    const totalStakeNum = cabalStake + honestStake || 1;

    return {
      ok: true,
      env,
      epoch: readEpoch(),
      storageKind: env === 'testnet' ? 'zg-storage' : 'local-fs',
      totalAgents: agents.length,
      totalStakedEth: ETH(totalStaked, 2),
      agents,
      bounties,
      problems,
      collusion: {
        cabalPct: cabalStake / totalStakeNum,
        series: cabalShareSeries(cabalStake, honestStake, 6),
      },
      addresses: dep,
      chainId: env === 'testnet' ? 16602 : 31337,
    };
  } catch (e: any) {
    return emptyState(env, e?.shortMessage ?? e?.message ?? 'chain read failed');
  }
}

function readEpoch(): number {
  const path = resolve(REPO_ROOT, '.frontier/scenario.json');
  if (!existsSync(path)) return 1;
  try {
    return JSON.parse(readFileSync(path, 'utf8')).epoch ?? 1;
  } catch {
    return 1;
  }
}

function emptyState(env: string, error: string): StateResponse {
  return {
    ok: false,
    error,
    env,
    epoch: 0,
    storageKind: env === 'testnet' ? 'zg-storage' : 'local-fs',
    totalAgents: 0,
    totalStakedEth: '0.00',
    agents: [],
    bounties: [],
    problems: [],
    collusion: { cabalPct: 0, series: [] },
    addresses: null,
    chainId: env === 'testnet' ? 16602 : 31337,
  };
}

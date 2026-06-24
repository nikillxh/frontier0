'use client';

import { AgentRegistryAbi, BountyEscrowAbi } from '@frontier0/shared/abis';
import { Bot, Coins, Network, Upload } from 'lucide-react';
import { useEffect } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { parseEther } from 'viem';
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { AgentBriefing } from '@/components/AgentBriefing';
import { FadeIn } from '@/components/motion';
import { Select } from '@/components/Select';
import { Panel } from '@/components/ui';
import type { BountyRow, ProblemRow } from '@/lib/types';
import { useFrontier } from '@/lib/useFrontier';

const CONFIRM_THRESHOLD = 0.05;

const txOpts = (label: string) => ({
  onSuccess: (hash: `0x${string}`) => toast(`${label} submitted`, { description: hash }),
  onError: (e: Error) => toast.error(`${label} failed`, { description: e.message.split('\n')[0] }),
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] tracking-[0.18em] text-faint">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  'w-full rounded border border-border bg-bg-2 px-3 py-2 text-sm text-text outline-none transition-colors hover:border-border-bright focus:border-accent focus:ring-1 focus:ring-accent/40';
const btnCls =
  'inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-bright active:bg-accent-deep disabled:cursor-not-allowed disabled:bg-border disabled:text-faint';

const isPosNum = (s: string): boolean => {
  const n = Number(s);
  return Number.isFinite(n) && n > 0;
};
const isHex = (s: string): boolean => /^0x[0-9a-fA-F]*$/.test(s);

function problemOptions(problems: { id: number; title: string }[]) {
  return problems.map((p) => ({ value: String(p.id), label: `#${p.id} ${p.title}` }));
}

function TxStatus({ hash, error }: { hash?: `0x${string}`; error: Error | null }) {
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });
  useEffect(() => {
    if (isSuccess && hash) toast.success('Confirmed', { description: hash });
  }, [isSuccess, hash]);
  if (error) return <p className="mt-2 text-xs text-bad">{error.message.split('\n')[0]}</p>;
  if (!hash) return null;
  if (isLoading) return <p className="mt-2 text-xs text-muted">confirming {hash.slice(0, 10)}…</p>;
  if (isSuccess) return <p className="mt-2 text-xs text-good">confirmed ✓ {hash.slice(0, 10)}</p>;
  return <p className="mt-2 text-xs text-muted">submitted {hash.slice(0, 10)}</p>;
}

export default function Participate() {
  const { data } = useFrontier();
  const { address, isConnected } = useAccount();
  const addr = data?.addresses;
  const myAgents = (data?.agents ?? []).filter(
    (a) => address && a.owner.toLowerCase() === address.toLowerCase(),
  );

  return (
    <div className="space-y-8">
      <FadeIn>
        <h1 className="text-2xl font-bold tracking-[0.08em]">PARTICIPATE</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Register an agent, post a bounty, submit a solution, or have an agent hire other agents
          for computation, with on-chain spend caps, depth limits, and explicit user confirmation.
        </p>
      </FadeIn>

      {!isConnected && (
        <Panel title="WALLET">
          <p className="text-sm text-muted">Connect a wallet (top-right) to participate.</p>
        </Panel>
      )}

      <AgentBriefing data={data} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <RegisterAgent addr={addr?.AgentRegistry} disabled={!isConnected} />
        <PostBounty
          addr={addr?.BountyEscrow}
          disabled={!isConnected}
          problems={data?.problems ?? []}
        />
        <SubBounty
          addr={addr?.BountyEscrow}
          disabled={!isConnected}
          problems={data?.problems ?? []}
          myAgents={myAgents}
        />
      </div>

      <SubmitSolution
        addr={addr?.BountyEscrow}
        disabled={!isConnected}
        bounties={data?.bounties ?? []}
        problems={data?.problems ?? []}
        myAgents={myAgents}
      />
    </div>
  );
}

function RegisterAgent({ addr, disabled }: { addr?: `0x${string}`; disabled: boolean }) {
  const [name, setName] = useState('my-agent');
  const [role, setRole] = useState('3');
  const [stake, setStake] = useState('1');
  const [maxPerTx, setMaxPerTx] = useState('0.5');
  const { writeContract, data: hash, error, isPending } = useWriteContract();

  return (
    <Panel title="REGISTER AGENT" icon={<Bot size={13} />}>
      <div className="space-y-3">
        <Field label="NAME">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="ROLE">
          <Select
            value={role}
            onChange={setRole}
            options={[
              { value: '1', label: 'Solver' },
              { value: '2', label: 'Verifier' },
              { value: '3', label: 'Both' },
            ]}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="STAKE (0G)">
            <input className={inputCls} value={stake} onChange={(e) => setStake(e.target.value)} />
          </Field>
          <Field label="MAX/SUB-BOUNTY (0G)">
            <input
              className={inputCls}
              value={maxPerTx}
              onChange={(e) => setMaxPerTx(e.target.value)}
            />
          </Field>
        </div>
        <button
          className={btnCls}
          disabled={disabled || isPending || !addr || !name.trim() || !isPosNum(stake) || !isPosNum(maxPerTx)}
          onClick={() =>
            addr &&
            writeContract({
              address: addr,
              abi: AgentRegistryAbi,
              functionName: 'registerAgent',
              args: [name, Number(role), parseEther(maxPerTx || '0'), `agent://${name}`],
              value: parseEther(stake || '0'),
            }, txOpts('Register agent'))
          }
        >
          {isPending ? 'SIGNING…' : 'REGISTER'}
        </button>
        <TxStatus hash={hash} error={error} />
      </div>
    </Panel>
  );
}

function PostBounty({
  addr,
  disabled,
  problems,
}: {
  addr?: `0x${string}`;
  disabled: boolean;
  problems: { id: number; title: string }[];
}) {
  const [problemId, setProblemId] = useState('1');
  const [reward, setReward] = useState('0.02');
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86_400);

  return (
    <Panel title="POST BOUNTY" icon={<Coins size={13} />}>
      <div className="space-y-3">
        <Field label="PROBLEM">
          <Select value={problemId} onChange={setProblemId} options={problemOptions(problems)} />
        </Field>
        <Field label="REWARD (0G)">
          <input className={inputCls} value={reward} onChange={(e) => setReward(e.target.value)} />
        </Field>
        <button
          className={btnCls}
          disabled={disabled || isPending || !addr || !isPosNum(reward)}
          onClick={() =>
            addr &&
            writeContract({
              address: addr,
              abi: BountyEscrowAbi,
              functionName: 'postBounty',
              args: [BigInt(problemId), deadline],
              value: parseEther(reward || '0'),
            }, txOpts('Bounty'))
          }
        >
          {isPending ? 'SIGNING…' : 'FUND BOUNTY'}
        </button>
        <TxStatus hash={hash} error={error} />
      </div>
    </Panel>
  );
}

function SubBounty({
  addr,
  disabled,
  problems,
  myAgents,
}: {
  addr?: `0x${string}`;
  disabled: boolean;
  problems: { id: number; title: string }[];
  myAgents: { id: number; name: string }[];
}) {
  const [agentId, setAgentId] = useState('');
  const [problemId, setProblemId] = useState('1');
  const [amount, setAmount] = useState('0.01');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86_400);
  const needsConfirm = Number(amount) > CONFIRM_THRESHOLD;
  const effectiveAgent = agentId || (myAgents[0] ? String(myAgents[0].id) : '');
  const canSubmit = !disabled && !!addr && !!effectiveAgent && isPosNum(amount);

  const submit = (confirmed: boolean) => {
    if (!addr || !effectiveAgent) return;
    writeContract({
      address: addr,
      abi: BountyEscrowAbi,
      functionName: 'createSubBounty',
      args: [BigInt(effectiveAgent), BigInt(problemId), deadline, 0n, confirmed],
      value: parseEther(amount || '0'),
    }, txOpts('Sub-bounty'));
    setConfirmOpen(false);
  };

  return (
    <Panel title="AGENT -> AGENT SUB-BOUNTY" icon={<Network size={13} />}>
      <div className="space-y-3">
        <Field label="YOUR AGENT">
          {myAgents.length > 0 ? (
            <Select
              value={effectiveAgent}
              onChange={setAgentId}
              options={myAgents.map((a) => ({ value: String(a.id), label: `#${a.id} ${a.name}` }))}
            />
          ) : (
            <p className="rounded border border-border bg-bg-2 px-3 py-2 text-xs text-faint">
              No agents under this wallet yet. Register one first.
            </p>
          )}
        </Field>
        <Field label="PROBLEM">
          <Select value={problemId} onChange={setProblemId} options={problemOptions(problems)} />
        </Field>
        <Field label="AMOUNT (0G)">
          <input className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <p className="text-[11px] leading-4 text-faint">
          Guardrails: amount ≤ your per-tx cap and remaining budget, depth ≤ 3, and amounts above{' '}
          {CONFIRM_THRESHOLD} 0G require explicit confirmation.
        </p>
        <button
          className={btnCls}
          disabled={!canSubmit || isPending}
          onClick={() => (needsConfirm ? setConfirmOpen(true) : submit(false))}
        >
          {isPending ? 'SIGNING…' : 'CREATE SUB-BOUNTY'}
        </button>
        <TxStatus hash={hash} error={error} />
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-md border border-accent-deep bg-panel p-6">
            <h3 className="text-sm font-semibold tracking-[0.15em] text-accent">CONFIRM SPEND</h3>
            <p className="mt-3 text-sm text-muted">
              This agent will spend <span className="text-text">{amount} 0G</span> hiring other
              agents for problem #{problemId}. This exceeds the {CONFIRM_THRESHOLD} 0G
              auto-confirmation threshold and needs your explicit approval.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-md border border-border px-4 py-2 text-sm text-muted transition-colors hover:text-text"
                onClick={() => setConfirmOpen(false)}
              >
                CANCEL
              </button>
              <button className={`${btnCls} w-auto`} onClick={() => submit(true)}>
                CONFIRM & SIGN
              </button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function SubmitSolution({
  addr,
  disabled,
  bounties,
  problems,
  myAgents,
}: {
  addr?: `0x${string}`;
  disabled: boolean;
  bounties: BountyRow[];
  problems: ProblemRow[];
  myAgents: { id: number; name: string }[];
}) {
  const open = bounties.filter((b) => b.status === 'OPEN');
  const [bountyId, setBountyId] = useState('');
  const [agentId, setAgentId] = useState('');
  const [artifactRoot, setArtifactRoot] = useState('');
  const [solution, setSolution] = useState('0x');
  const { writeContract, data: hash, error, isPending } = useWriteContract();

  const effBounty = bountyId || (open[0] ? String(open[0].id) : '');
  const effAgent = agentId || (myAgents[0] ? String(myAgents[0].id) : '');
  const bounty = open.find((b) => String(b.id) === effBounty);
  const problem = problems.find((p) => p.id === bounty?.problemId);
  const canSubmit =
    !disabled &&
    !!addr &&
    !!effBounty &&
    !!effAgent &&
    artifactRoot.trim().length > 0 &&
    isHex(solution || '0x');

  return (
    <Panel title="SUBMIT A SOLUTION" icon={<Upload size={13} />}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-3">
          <Field label="OPEN BOUNTY">
            {open.length > 0 ? (
              <Select
                value={effBounty}
                onChange={setBountyId}
                options={open.map((b) => ({ value: String(b.id), label: `#${b.id} ${b.title}` }))}
              />
            ) : (
              <p className="rounded border border-border bg-bg-2 px-3 py-2 text-xs text-faint">
                No open bounties. Fund one first.
              </p>
            )}
          </Field>
          <Field label="YOUR AGENT (SOLVER)">
            {myAgents.length > 0 ? (
              <Select
                value={effAgent}
                onChange={setAgentId}
                options={myAgents.map((a) => ({
                  value: String(a.id),
                  label: `#${a.id} ${a.name}`,
                }))}
              />
            ) : (
              <p className="rounded border border-border bg-bg-2 px-3 py-2 text-xs text-faint">
                Register a solver agent first.
              </p>
            )}
          </Field>
          <Field label="0G STORAGE ARTIFACT ROOT">
            <input
              className={inputCls}
              placeholder="0x… or storage root of your work"
              value={artifactRoot}
              onChange={(e) => setArtifactRoot(e.target.value)}
            />
          </Field>
          <Field label="ON-CHAIN ANSWER (HEX, OPTIONAL)">
            <input
              className={inputCls}
              placeholder="0x"
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
            />
          </Field>
          <button
            className={btnCls}
            disabled={!canSubmit || isPending}
            onClick={() =>
              addr &&
              writeContract(
                {
                  address: addr,
                  abi: BountyEscrowAbi,
                  functionName: 'submitSolution',
                  args: [
                    BigInt(effBounty),
                    BigInt(effAgent),
                    artifactRoot,
                    (solution || '0x') as `0x${string}`,
                  ],
                },
                txOpts('Solution'),
              )
            }
          >
            {isPending ? 'SIGNING…' : 'SUBMIT SOLUTION'}
          </button>
          <TxStatus hash={hash} error={error} />
        </div>

        <div className="rounded-md border border-border bg-bg-2/40 p-4 text-sm leading-6 text-muted">
          <p className="text-[11px] tracking-[0.18em] text-faint">HOW AGENTS SUBMIT</p>
          <ol className="mt-3 list-decimal space-y-2 pl-4">
            <li>
              An agent runs the problem off-chain (0G Compute / its own solver) and produces a
              solution artifact.
            </li>
            <li>
              It pins that artifact to <span className="text-text">0G Storage</span> and gets back a
              content root.
            </li>
            <li>
              It calls{' '}
              <code className="text-accent">submitSolution(bountyId, agentId, artifactRoot, answer)</code>{' '}
              on-chain, exactly what this form does.
            </li>
            <li>
              {problem?.vtype === 'Deterministic' ? (
                <>
                  This bounty is <span className="text-text">objectively checkable</span>: the{' '}
                  on-chain answer (hex) is replayed by the checker contract. The first valid answer
                  wins.
                </>
              ) : (
                <>
                  Verifier agents then score the submission under{' '}
                  <span className="text-text">commit-reveal</span> consensus; the artifact root is
                  what they review.
                </>
              )}
            </li>
          </ol>
          <p className="mt-3 text-[11px] leading-5 text-faint">
            Most submissions come from autonomous agents via the runtime/SDK; this form lets you do
            it manually from your wallet for the agents you own.
          </p>
        </div>
      </div>
    </Panel>
  );
}

'use client';

import { ArrowLeft, Database, FlaskConical, ShieldCheck, Trophy, Upload } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CopyAddress } from '@/components/CopyAddress';
import { FadeIn } from '@/components/motion';
import { Skeleton } from '@/components/Skeleton';
import { Badge, Panel, phaseBadge } from '@/components/ui';
import { pct } from '@/lib/format';
import { useFrontier } from '@/lib/useFrontier';

export default function ProblemDetail() {
  const params = useParams();
  const id = Number(params.id);
  const { data, isLoading } = useFrontier();

  const problem = data?.problems.find((p) => p.id === id);
  const bounties = (data?.bounties ?? []).filter((b) => b.problemId === id);
  const deterministic = problem?.vtype === 'Deterministic';

  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="space-y-6">
        <Link href="/market" className="inline-flex items-center gap-2 text-xs text-muted hover:text-text">
          <ArrowLeft size={14} /> BACK TO MARKET
        </Link>
        <Panel title="NOT FOUND">
          <p className="text-sm text-muted">No problem #{id} on chain.</p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <FadeIn>
        <Link
          href="/market"
          className="inline-flex items-center gap-2 text-xs tracking-[0.12em] text-muted transition-colors hover:text-text"
        >
          <ArrowLeft size={14} /> BACK TO MARKET
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-[0.04em]">{problem.title}</h1>
          <Badge kind="neutral">{problem.category}</Badge>
          <Badge kind="neutral">{deterministic ? 'ON-CHAIN CHECKER' : 'PEER REVIEW'}</Badge>
        </div>
        <div className="mt-1 text-[11px] tracking-[0.15em] text-faint">PROBLEM #{problem.id}</div>
      </FadeIn>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="STATEMENT" icon={<FlaskConical size={13} />}>
          <p className="whitespace-pre-line text-sm leading-7 text-text">{problem.spec}</p>
          <div className="mt-5 flex items-center gap-2 border-t border-border/50 pt-3 text-[11px] text-faint">
            <Database size={12} />
            0G Storage spec root:{' '}
            {problem.specRoot ? (
              <CopyAddress value={problem.specRoot} className="text-[11px]" />
            ) : (
              <span className="font-mono text-muted">n/a</span>
            )}
          </div>
        </Panel>

        <Panel title="HOW IT IS JUDGED" icon={<ShieldCheck size={13} />}>
          <p className="text-sm leading-6 text-muted">
            {deterministic ? (
              <>
                This problem is <span className="text-accent">objectively checkable</span>. A solver
                submits an answer and an on-chain checker contract verifies it deterministically —
                no opinions, no voting. The first valid answer wins the full reward.
              </>
            ) : (
              <>
                This is an <span className="text-accent">open-ended</span> problem. Verifier agents
                score submissions under stake-weighted, commit-reveal consensus: scores are sealed,
                then revealed, so no one can copy the emerging verdict. A colluding minority cannot
                pass bad work or bury good work. The solver takes 80% of the reward; aligned
                verifiers split the rest.
              </>
            )}
          </p>
        </Panel>
      </div>

      <Panel
        title="BOUNTIES & SUBMISSIONS"
        right={
          <Link
            href="/participate"
            className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-accent transition-colors hover:bg-accent/10"
          >
            <Upload size={12} /> SUBMIT
          </Link>
        }
      >
        {bounties.length === 0 ? (
          <div className="flex flex-col items-start gap-3 py-2">
            <p className="text-sm text-muted">No bounties funded yet.</p>
            <Link
              href="/participate"
              className="rounded-md bg-accent px-4 py-2 text-xs font-semibold tracking-[0.12em] text-white transition-colors hover:bg-accent-bright"
            >
              FUND A BOUNTY
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bounties.map((b) => (
              <div key={b.id} className="rounded-md border border-border bg-bg-2/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-faint">BOUNTY #{b.id}</span>
                    <span className="text-accent">{b.rewardEth} 0G</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span>{b.submissions} submission{b.submissions === 1 ? '' : 's'}</span>
                    {phaseBadge(b.status, b.phase)}
                  </div>
                </div>

                {b.submissionList.length === 0 ? (
                  <p className="mt-3 text-xs text-faint">
                    No submissions yet — an agent solves off-chain, pins the artifact to 0G Storage,
                    then calls submitSolution.
                  </p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="text-left text-[10px] tracking-[0.16em] text-faint">
                          <th className="pb-2 font-normal">SOLVER</th>
                          <th className="pb-2 font-normal">0G ARTIFACT</th>
                          <th className="pb-2 text-right font-normal">
                            {deterministic ? 'CHECK' : 'CONSENSUS'}
                          </th>
                          <th className="pb-2 text-right font-normal">VERIFIERS</th>
                          <th className="pb-2 text-right font-normal">RESULT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.submissionList.map((s) => (
                          <tr key={s.id} className="border-t border-border/50">
                            <td className="py-2 pr-3 text-text">{s.agentName}</td>
                            <td className="py-2 pr-3">
                              {s.artifactRoot ? (
                                <CopyAddress value={s.artifactRoot} className="text-xs" />
                              ) : (
                                <span className="text-faint">-</span>
                              )}
                            </td>
                            <td className="py-2 text-right text-muted">
                              {deterministic ? '—' : pct(s.consensus)}
                            </td>
                            <td className="py-2 text-right text-muted">{s.verifierCount}</td>
                            <td className="py-2 text-right">
                              {s.isWinner ? (
                                <span className="inline-flex items-center gap-1 text-good">
                                  <Trophy size={12} /> WINNER
                                </span>
                              ) : (
                                <span className="text-faint">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

'use client';

import { FlaskConical, ListChecks, Target } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FadeIn } from '@/components/motion';
import { SkeletonRows } from '@/components/Skeleton';
import { Badge, Panel, phaseBadge } from '@/components/ui';
import { useFrontier } from '@/lib/useFrontier';

export default function Market() {
  const { data, isLoading } = useFrontier();
  const router = useRouter();
  return (
    <div className="space-y-8">
      <FadeIn>
        <h1 className="text-2xl font-bold tracking-[0.08em]">THE FRONTIER MARKET</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Open bounties on humanity&apos;s hardest problems. Checkable problems are validated by an
          on-chain checker; open-ended ones by commit-reveal, collusion-resistant peer review.
        </p>
      </FadeIn>

      <Panel title="OPEN & SETTLED BOUNTIES" icon={<Target size={13} />}>
        {isLoading ? (
          <SkeletonRows rows={4} cols={7} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[10px] tracking-[0.18em] text-faint">
                  <th className="pb-3 font-normal">#</th>
                  <th className="pb-3 font-normal">PROBLEM</th>
                  <th className="pb-3 font-normal">CATEGORY</th>
                  <th className="pb-3 font-normal">VERIFICATION</th>
                  <th className="pb-3 font-normal">SUBS</th>
                  <th className="pb-3 text-right font-normal">REWARD</th>
                  <th className="pb-3 text-right font-normal">PHASE</th>
                </tr>
              </thead>
              <tbody>
                {(data?.bounties ?? []).map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => router.push(`/problems/${b.problemId}`)}
                    className="cursor-pointer border-t border-border/50 transition-colors hover:bg-accent/5"
                  >
                    <td className="py-3 pr-3 text-faint">{b.id}</td>
                    <td className="py-3 pr-3">{b.title}</td>
                    <td className="py-3 pr-3 text-muted">{b.category}</td>
                    <td className="py-3 pr-3">
                      <Badge kind="neutral">{b.vtype === 'Deterministic' ? 'CHECKER' : 'PEER'}</Badge>
                    </td>
                    <td className="py-3 pr-3 text-muted">{b.submissions}</td>
                    <td className="py-3 text-right text-accent">{b.rewardEth} 0G</td>
                    <td className="py-3 text-right">{phaseBadge(b.status, b.phase)}</td>
                  </tr>
                ))}
                {(data?.bounties ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-muted">
                      no bounties yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="PROBLEM CATALOGUE" icon={<ListChecks size={13} />}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(data?.problems ?? []).map((p) => (
            <Link
              key={p.id}
              href={`/problems/${p.id}`}
              className="block rounded-md border border-border bg-panel-2/40 p-4 transition-colors hover:border-accent/40"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <FlaskConical size={14} className="text-accent" />
                  {p.title}
                </span>
                <Badge kind="neutral">{p.vtype === 'Deterministic' ? 'CHECKER' : 'PEER'}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted">{p.spec}</p>
              <div className="mt-2 text-[11px] uppercase tracking-[0.15em] text-faint">
                {p.category}
              </div>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}

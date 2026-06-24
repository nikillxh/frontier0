'use client';

import { Crown, Trophy } from 'lucide-react';
import { CopyAddress } from '@/components/CopyAddress';
import { FadeIn } from '@/components/motion';
import { SkeletonRows } from '@/components/Skeleton';
import { Badge, Panel } from '@/components/ui';
import { useFrontier } from '@/lib/useFrontier';

export default function Leaderboard() {
  const { data, isLoading } = useFrontier();
  const ranked = [...(data?.agents ?? [])].sort(
    (a, b) => b.repScore - a.repScore || Number(b.earnedEth) - Number(a.earnedEth),
  );

  return (
    <div className="space-y-8">
      <FadeIn>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-[0.08em]">
          <Trophy size={20} className="text-accent" /> LEADERBOARD
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Agents and their owners ranked by on-chain reputation: solve success, verification
          accuracy versus consensus, and total earnings. Reconstructed directly from chain events.
        </p>
      </FadeIn>

      {isLoading ? (
        <Panel title="AGENT RANKINGS">
          <SkeletonRows rows={6} cols={7} />
        </Panel>
      ) : (
      <Panel title="AGENT RANKINGS" icon={<Crown size={13} />}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-[10px] tracking-[0.18em] text-faint">
                <th className="pb-3 font-normal">RANK</th>
                <th className="pb-3 font-normal">AGENT</th>
                <th className="pb-3 font-normal">OWNER</th>
                <th className="pb-3 font-normal">FACTION</th>
                <th className="pb-3 text-right font-normal">REP</th>
                <th className="pb-3 text-right font-normal">SOLVES</th>
                <th className="pb-3 text-right font-normal">EARNED</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((a, i) => (
                <tr key={a.id} className="border-t border-border/60">
                  <td className="py-3 pr-3 text-accent">#{i + 1}</td>
                  <td className="py-3 pr-3">{a.name}</td>
                  <td className="py-3 pr-3"><CopyAddress value={a.owner} /></td>
                  <td className="py-3 pr-3">
                    <Badge kind={a.faction === 'cabal' ? 'cabal' : 'honest'}>
                      {a.faction.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="py-3 text-right">{a.repScore}</td>
                  <td className="py-3 text-right text-muted">{a.solves}</td>
                  <td className="py-3 text-right text-accent">{a.earnedEth} 0G</td>
                </tr>
              ))}
              {ranked.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-muted">
                    {isLoading ? 'loading…' : 'no agents yet'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      )}
    </div>
  );
}

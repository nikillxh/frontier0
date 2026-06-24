'use client';

import { Activity, ArrowUpDown, Boxes, Coins, ShieldCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { CollusionChart } from '@/components/CollusionChart';
import { FadeIn, Stagger, StaggerItem } from '@/components/motion';
import { SkeletonRows } from '@/components/Skeleton';
import { Badge, Bar, Panel, StatTile } from '@/components/ui';
import { pct } from '@/lib/format';
import type { AgentRow } from '@/lib/types';
import { useFrontier } from '@/lib/useFrontier';

type SortKey = 'stake' | 'consensus' | 'incentive' | 'dividend';

export default function Dashboard() {
  const { data, isLoading } = useFrontier();
  const [sort, setSort] = useState<SortKey>('stake');
  const [dir, setDir] = useState<1 | -1>(-1);
  const [faction, setFaction] = useState<'all' | 'honest' | 'cabal'>('all');

  const agents = data?.agents ?? [];
  const maxStake = Math.max(1, ...agents.map((a) => Number(a.stakeWei)));

  const sortVal = (a: AgentRow): number =>
    sort === 'stake' ? Number(a.stakeWei) : (a[sort] as number);
  const rows = agents
    .filter((a) => faction === 'all' || a.faction === faction)
    .sort((a, b) => (sortVal(a) - sortVal(b)) * dir);

  const toggle = (k: SortKey) => {
    if (k === sort) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSort(k);
      setDir(-1);
    }
  };

  const Th = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="pb-3 text-right font-normal">
      <button
        onClick={() => toggle(k)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-text ${
          sort === k ? 'text-accent' : ''
        }`}
      >
        {label}
        <ArrowUpDown size={11} className={sort === k ? 'opacity-100' : 'opacity-40'} />
      </button>
    </th>
  );

  return (
    <div className="space-y-8">
      <FadeIn>
        <div className="flex items-center gap-2 text-[11px] tracking-[0.2em] text-muted">
          <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-good" />
          {data?.ok ? 'LIVE' : 'OFFLINE'} · {data?.storageKind ?? '-'} · {data?.env ?? '-'}
        </div>
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-[0.04em] md:text-5xl">
          <span className="gradient-text">Humanity&apos;s hardest problems,</span>
          <br />
          solved by a verifiable agent market.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-muted">
          Agent swarms attempt P vs NP, cryptanalysis, security and biology bounties and peer-verify
          each other under collusion-resistant, commit-reveal consensus. Compute runs in 0G TEEs,
          artifacts live on 0G Storage, settlement and reputation on 0G Chain.
        </p>
      </FadeIn>

      {!data?.ok && !isLoading && (
        <Panel title="STATUS">
          <p className="text-sm text-bad">
            Chain state unavailable: {data?.error ?? 'unknown'}. Run{' '}
            <code className="text-accent">./scripts/dev.sh</code>.
          </p>
        </Panel>
      )}

      <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StaggerItem>
          <StatTile label="EPOCH" numeric={data?.epoch ?? 0} accent icon={<Boxes size={13} />} />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="AGENTS" numeric={data?.totalAgents ?? 0} icon={<Users size={13} />} />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="STAKED"
            numeric={Number(data?.totalStakedEth ?? 0)}
            decimals={2}
            suffix=" 0G"
            icon={<Coins size={13} />}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="CABAL SHARE"
            numeric={(data?.collusion.cabalPct ?? 0) * 100}
            decimals={1}
            suffix="%"
            icon={<ShieldCheck size={13} />}
          />
        </StaggerItem>
      </Stagger>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Panel
          title="AGENTS"
          icon={<Users size={13} />}
          right={
            <div className="flex gap-1">
              {(['all', 'honest', 'cabal'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFaction(f)}
                  className={`rounded border px-2 py-[2px] text-[10px] tracking-[0.12em] transition-colors ${
                    faction === f
                      ? 'border-accent text-accent'
                      : 'border-border text-faint hover:text-muted'
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          }
        >
          {isLoading ? (
            <SkeletonRows rows={6} cols={6} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-[10px] tracking-[0.18em] text-faint">
                    <th className="pb-3 font-normal">AGENT</th>
                    <th className="pb-3 font-normal">ROLE</th>
                    <Th k="stake" label="STAKE" />
                    <Th k="consensus" label="CONSENSUS" />
                    <Th k="incentive" label="INCENTIVE" />
                    <Th k="dividend" label="DIVIDEND" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr
                      key={a.id}
                      className="border-t border-border/50 transition-colors hover:bg-accent/5"
                    >
                      <td className="py-3 pr-3">{a.name}</td>
                      <td className="py-3 pr-3">
                        <Badge kind={a.faction === 'cabal' ? 'cabal' : 'honest'}>{a.role}</Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Bar value={Number(a.stakeWei)} max={maxStake} />
                          <span className="w-12 text-right text-muted">{a.stakeEth}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-muted">{pct(a.consensus)}</td>
                      <td className="py-3 text-right text-muted">{pct(a.incentive)}</td>
                      <td className="py-3 text-right text-accent">{pct(a.dividend)}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted">
                        no agents
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 border-t border-border/50 pt-3 text-[11px] leading-5 text-faint">
            <span className="text-muted">CONSENSUS</span> = how closely this agent agrees with the
            network verdict. <span className="text-muted">INCENTIVE</span> /{' '}
            <span className="text-muted">DIVIDEND</span> = its share of the solver / verifier reward
            pool. Each column sums to 100% across all agents.
          </p>
        </Panel>

        <Panel title="COLLUSION RESISTANCE" icon={<Activity size={13} />}>
          <CollusionChart series={data?.collusion.series ?? []} />
          <p className="mt-4 text-xs leading-5 text-muted">
            The self-dealing cabal holds {pct(data?.collusion.cabalPct ?? 0)} of stake, below the
            kappa=50% inflection, so its consensus stays clipped and its effective share decays each
            epoch. A minority cabal can neither pass its own bad submissions nor suppress honest
            ones, and commit-reveal stops it copying honest scores from the mempool.
          </p>
        </Panel>
      </div>
    </div>
  );
}

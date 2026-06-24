import type { ReactNode } from 'react';
import { AnimatedNumber } from './AnimatedNumber';

export function Panel({
  title,
  children,
  right,
  icon,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  right?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`glass relative rounded-lg transition-colors ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
          <h2 className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-muted">
            {icon}
            {title}
          </h2>
          {right}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatTile({
  label,
  value,
  numeric,
  decimals = 0,
  suffix = '',
  accent,
  icon,
}: {
  label: string;
  value?: ReactNode;
  numeric?: number;
  decimals?: number;
  suffix?: string;
  accent?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="glass rounded-lg px-5 py-4 transition-transform hover:-translate-y-0.5">
      <div className="flex items-center gap-2 text-[10px] tracking-[0.22em] text-faint">
        {icon}
        {label}
      </div>
      <div className={`mt-2 text-2xl font-bold ${accent ? 'text-accent' : 'text-text'}`}>
        {numeric !== undefined ? (
          <AnimatedNumber value={numeric} decimals={decimals} suffix={suffix} />
        ) : (
          value
        )}
      </div>
    </div>
  );
}

type BadgeKind =
  | 'honest'
  | 'cabal'
  | 'neutral'
  | 'open'
  | 'final'
  | 'refund'
  | 'commit'
  | 'reveal'
  | 'ready';

export function Badge({ kind, children }: { kind: BadgeKind; children: ReactNode }) {
  const map: Record<BadgeKind, string> = {
    honest: 'border-[#3a6b56] text-good',
    cabal: 'border-[#6b4a2a] text-bad',
    neutral: 'border-border-bright text-muted',
    open: 'border-accent-deep text-accent',
    final: 'border-[#3a6b56] text-good',
    refund: 'border-border-bright text-muted',
    commit: 'border-accent-deep text-accent',
    reveal: 'border-[#b8862f] text-[#f0c060]',
    ready: 'border-accent text-accent-bright',
  };
  return (
    <span
      className={`inline-block rounded border px-2 py-[2px] text-[10px] tracking-[0.15em] ${map[kind]}`}
    >
      {children}
    </span>
  );
}

export function Bar({ value, max, animate = true }: { value: number; max: number; animate?: boolean }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-[10px] w-full max-w-[120px] overflow-hidden rounded-sm bg-bg-2">
      <div
        className="bar h-full rounded-sm"
        style={{ width: `${w}%`, transition: animate ? 'width 0.9s cubic-bezier(0.22,1,0.36,1)' : undefined }}
      />
    </div>
  );
}

/** Phase label from BountyEscrow.bountyPhase / status. */
export function phaseBadge(status: string, phase?: number) {
  if (status === 'FINALIZED') return <Badge kind="final">FINALIZED</Badge>;
  if (status === 'REFUNDED') return <Badge kind="refund">REFUNDED</Badge>;
  if (phase === 1) return <Badge kind="reveal">REVEAL</Badge>;
  if (phase === 2) return <Badge kind="ready">READY</Badge>;
  return <Badge kind="open">OPEN</Badge>;
}

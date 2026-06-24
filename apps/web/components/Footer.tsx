'use client';

import { CopyAddress } from '@/components/CopyAddress';
import { useFrontier } from '@/lib/useFrontier';

const CONTRACTS: { key: string; label: string }[] = [
  { key: 'BountyEscrow', label: 'BountyEscrow' },
  { key: 'AgentRegistry', label: 'AgentRegistry' },
  { key: 'ProblemRegistry', label: 'ProblemRegistry' },
  { key: 'Reputation', label: 'Reputation' },
];

export function Footer() {
  const { data } = useFrontier();
  const addrs = data?.addresses as Record<string, string> | null | undefined;

  return (
    <footer className="mx-auto max-w-[1180px] px-5 py-10">
      {addrs && (
        <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-border pt-6 sm:grid-cols-4">
          {CONTRACTS.map((c) => (
            <div key={c.key} className="flex flex-col gap-1">
              <span className="text-[10px] tracking-[0.18em] text-faint">{c.label.toUpperCase()}</span>
              <CopyAddress value={addrs[c.key]} className="text-xs" />
            </div>
          ))}
        </div>
      )}
      <div className="text-[11px] tracking-[0.15em] text-faint">
        FRONTIER0 · BUILT ON 0G · COMPUTE · STORAGE · CHAIN
      </div>
    </footer>
  );
}

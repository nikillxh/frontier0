'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'DASHBOARD' },
  { href: '/market', label: 'MARKET' },
  { href: '/participate', label: 'PARTICIPATE' },
  { href: '/leaderboard', label: 'LEADERBOARD' },
  { href: '/docs', label: 'DOCS' },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-4">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold">
            <span className="inline-block h-2.5 w-2.5 rotate-45 rounded-[2px] bg-accent" />
            <span className="tracking-[0.25em]">FRONTIER</span>
            <span className="-ml-[0.22em] text-accent">0</span>
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {LINKS.map((l) => {
              const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`text-xs tracking-[0.18em] transition-colors ${
                    active ? 'text-accent' : 'text-muted hover:text-text'
                  }`}
                >
                  {l.label}
                  {active && <div className="mt-2 h-px w-full bg-accent" />}
                </Link>
              );
            })}
          </nav>
        </div>
        <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
      </div>
      <nav className="flex items-center gap-5 overflow-x-auto border-t border-border px-5 py-2 md:hidden">
        {LINKS.map((l) => {
          const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap text-[11px] tracking-[0.15em] transition-colors ${
                active ? 'text-accent' : 'text-muted'
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

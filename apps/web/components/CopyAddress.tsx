'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { short } from '@/lib/format';

/**
 * Renders a truncated address/hash with a one-click copy button.
 * `mono` keeps the displayed value full instead of shortening.
 */
export function CopyAddress({
  value,
  label,
  full,
  className = '',
}: {
  value?: string;
  label?: string;
  full?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-faint">-</span>;

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Copied', { description: short(value) });
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={`Copy ${value}`}
      className={`group inline-flex items-center gap-1.5 font-mono text-muted transition-colors hover:text-text ${className}`}
    >
      <span>{label ?? (full ? value : short(value))}</span>
      {copied ? (
        <Check size={12} className="text-good" />
      ) : (
        <Copy size={12} className="text-faint transition-colors group-hover:text-accent" />
      )}
    </button>
  );
}

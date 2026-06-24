'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Dark-themed dropdown. Native <select> option lists render with the OS's
 * light popup which clashes with the theme, so this paints its own panel.
 */
export function Select({
  value,
  onChange,
  options,
  disabled,
  placeholder = 'Select…',
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setActive(idx < 0 ? 0 : idx);
    }
  }, [open, options, value]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open && options[active]) choose(options[active].value);
      else setOpen(true);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className="flex w-full items-center justify-between gap-2 rounded border border-border bg-bg-2 px-3 py-2 text-left text-sm text-text outline-none transition-colors hover:border-border-bright focus:border-accent focus:ring-1 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={`truncate ${selected ? 'text-text' : 'text-faint'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-faint transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border-bright bg-panel-2 p-1 shadow-xl shadow-black/40"
        >
          {options.map((o, i) => {
            const isSel = o.value === value;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={isSel}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o.value)}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded px-2.5 py-1.5 text-sm transition-colors ${
                  i === active ? 'bg-accent/15 text-text' : 'text-muted'
                }`}
              >
                <span className="truncate">{o.label}</span>
                {isSel && <Check size={14} className="shrink-0 text-accent" />}
              </li>
            );
          })}
          {options.length === 0 && (
            <li className="px-2.5 py-1.5 text-sm text-faint">No options</li>
          )}
        </ul>
      )}
    </div>
  );
}

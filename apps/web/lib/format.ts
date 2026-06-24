export function fmtEth(wei: bigint | string | number, digits = 2): string {
  const v = typeof wei === 'bigint' ? wei : BigInt(wei);
  const s = v / 10n ** 18n;
  const frac = (v % 10n ** 18n) / 10n ** BigInt(18 - digits);
  return `${s}.${frac.toString().padStart(digits, '0')}`;
}

export function pct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

export function short(addr?: string): string {
  if (!addr) return '-';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function num(x: number, digits = 3): string {
  return x.toFixed(digits);
}

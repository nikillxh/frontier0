// TypeScript mirror of contracts/src/lib/YumaConsensus.sol.
// Kept byte-for-byte equivalent in behavior so off-chain dashboards match on-chain results.

export const SCALE = 10_000;

/**
 * Stake-weighted consensus score at threshold `kappaBps`.
 * The consensus is the largest score `v` such that the stake-weighted mass of
 * verifiers scoring >= v is at least `kappa` of total stake.
 */
export function consensusScore(scores: number[], stakes: bigint[], kappaBps: number): number {
  const n = scores.length;
  if (n === 0 || n !== stakes.length) return 0;

  let total = 0n;
  for (const s of stakes) total += s;
  if (total === 0n) return 0;

  const required = (total * BigInt(kappaBps)) / BigInt(SCALE);

  let consensus = 0;
  for (let j = 0; j < n; j++) {
    const v = scores[j]!;
    if (v <= consensus) continue;
    let mass = 0n;
    for (let i = 0; i < n; i++) {
      if (scores[i]! >= v) mass += stakes[i]!;
    }
    if (mass >= required) consensus = v;
  }
  return consensus;
}

/** Closeness of a score to consensus in [0, SCALE]; drives verifier dividends. */
export function closeness(score: number, consensus: number): number {
  const diff = Math.abs(score - consensus);
  return diff >= SCALE ? 0 : SCALE - diff;
}

/**
 * Off-chain projection of how a colluding group's effective stake share decays
 * across epochs once its consensus stays clipped below kappa. Used by the
 * dashboard's collusion-resistance chart.
 */
export function cabalShareSeries(
  cabalStake: number,
  honestStake: number,
  epochs: number,
  decay = 0.04,
): number[] {
  const total = cabalStake + honestStake;
  if (total === 0) return new Array(epochs).fill(0);
  const base = cabalStake / total;
  const out: number[] = [];
  for (let e = 0; e < epochs; e++) {
    // Below 50% the cabal is clipped, so its share erodes; above 50% it would grow.
    const factor = base < 0.5 ? Math.pow(1 - decay, e) : Math.pow(1 + decay, e);
    out.push(base * factor);
  }
  return out;
}

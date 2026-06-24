import { type ProblemDef, factorize } from '@frontier0/shared';
import { type Hex, encodeAbiParameters, encodePacked, keccak256 } from 'viem';

/** Brute-force a proof-of-work nonce matching the difficulty (leading zero bits). */
export function mineNonce(challenge: Hex, difficulty: number): bigint {
  const shift = BigInt(256 - difficulty);
  for (let nonce = 0n; nonce < 50_000_000n; nonce++) {
    const h = keccak256(encodePacked(['bytes32', 'uint256'], [challenge, nonce]));
    if (BigInt(h) >> shift === 0n) return nonce;
  }
  throw new Error('proof-of-work nonce not found within bound');
}

export const factorSpec = (n: bigint): Hex => encodeAbiParameters([{ type: 'uint256' }], [n]);
export const factorSolution = (p: bigint, q: bigint): Hex =>
  encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }], [p, q]);

export const powSpec = (challenge: Hex, difficulty: number): Hex =>
  encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }], [challenge, BigInt(difficulty)]);
export const powSolution = (nonce: bigint): Hex =>
  encodeAbiParameters([{ type: 'uint256' }], [nonce]);

/** On-chain compact spec for a deterministic problem (empty for peer problems). */
export function onchainSpecFor(def: ProblemDef): Hex {
  if (def.checker === 'factor' && def.factorN !== undefined) return factorSpec(def.factorN);
  if (def.checker === 'pow' && def.powChallenge && def.powDifficulty)
    return powSpec(def.powChallenge, def.powDifficulty);
  return '0x';
}

/** Compute the deterministic solution bytes for a checkable problem. */
export function solveDeterministic(def: ProblemDef): { solution: Hex; detail: string } {
  if (def.checker === 'factor' && def.factorN !== undefined) {
    const f = factorize(def.factorN);
    if (!f) throw new Error(`could not factor ${def.factorN}`);
    return { solution: factorSolution(f[0], f[1]), detail: `p=${f[0]} q=${f[1]}` };
  }
  if (def.checker === 'pow' && def.powChallenge && def.powDifficulty) {
    const nonce = mineNonce(def.powChallenge, def.powDifficulty);
    return { solution: powSolution(nonce), detail: `nonce=${nonce}` };
  }
  throw new Error(`no deterministic solver for ${def.key}`);
}

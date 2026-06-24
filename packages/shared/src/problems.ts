import { VerifType } from './types';

export type CheckerKind = 'factor' | 'pow' | 'none';

export interface ProblemDef {
  key: string;
  title: string;
  category: string;
  vtype: VerifType;
  checker: CheckerKind;
  /** Full human-readable statement; pinned to 0G Storage as the problem spec. */
  spec: string;
  /** Deterministic factoring target. */
  factorN?: bigint;
  /** Deterministic proof-of-work parameters. */
  powChallenge?: `0x${string}`;
  powDifficulty?: number;
  /** Suggested bounty reward (wei) for seeding. */
  reward: bigint;
}

const ETH = (n: string): bigint => BigInt(Math.round(Number(n) * 1e6)) * 10n ** 12n;

/**
 * A catalogue spanning the frontier: some are objectively checkable (a machine can
 * verify the answer), others are open-ended and judged by collusion-resistant peer
 * review. This honesty is the product's integrity story.
 */
export const SEED_PROBLEMS: ProblemDef[] = [
  {
    key: 'rsa-factor',
    title: 'Factor a semiprime modulus',
    category: 'cryptography',
    vtype: VerifType.Deterministic,
    checker: 'factor',
    spec: 'Recover the prime factors p, q of the semiprime N = 1000003 x 1000033. A correct factorization is trivially checkable on-chain; finding it is the work.',
    factorN: 1000003n * 1000033n, // product of two ~20-bit primes
    reward: ETH('0.03'),
  },
  {
    key: 'pow-grind',
    title: 'Find a 16-bit proof-of-work nonce',
    category: 'security',
    vtype: VerifType.Deterministic,
    checker: 'pow',
    spec: 'Find a nonce such that keccak256(challenge || nonce) has 16 leading zero bits. Models verifiable compute: cheap to check, costly to produce.',
    powChallenge: '0x46524f4e5449455230000000000000000000000000000000000000000000beef',
    powDifficulty: 16,
    reward: ETH('0.02'),
  },
  {
    key: 'p-vs-np',
    title: 'P vs NP: a new lower-bound direction',
    category: 'complexity',
    vtype: VerifType.Peer,
    checker: 'none',
    spec: 'Propose a novel, non-trivial direction toward separating P and NP. No final proof is claimed; verifier agents score originality, rigor and plausibility under collusion-resistant consensus.',
    reward: ETH('0.05'),
  },
  {
    key: 'protein-fold',
    title: 'Stabilizing mutations for a target protein',
    category: 'biology',
    vtype: VerifType.Peer,
    checker: 'none',
    spec: 'Given a protein sequence, propose point mutations expected to increase thermostability without loss of function, with mechanistic justification. Peer-reviewed by verifier agents.',
    reward: ETH('0.04'),
  },
  {
    key: 'exploit-audit',
    title: 'Find the reentrancy class bug in a contract',
    category: 'security',
    vtype: VerifType.Peer,
    checker: 'none',
    spec: 'Audit the attached contract and produce a proof-of-concept exploit narrative for any critical vulnerability. Verifier agents score severity and correctness.',
    reward: ETH('0.035'),
  },
];

/** Trial-division factorization for the demo semiprimes (fast for <= 64-bit). */
export function factorize(n: bigint): [bigint, bigint] | null {
  if (n % 2n === 0n) return [2n, n / 2n];
  let i = 3n;
  while (i * i <= n) {
    if (n % i === 0n) return [i, n / i];
    i += 2n;
  }
  return null;
}

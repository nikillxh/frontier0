// Shared enums + types mirroring the on-chain contracts.

export enum Role {
  None = 0,
  Solver = 1,
  Verifier = 2,
  Both = 3,
}

export enum VerifType {
  Deterministic = 0,
  Peer = 1,
}

export enum BountyStatus {
  Open = 0,
  Finalized = 1,
  Refunded = 2,
}

export const ROLE_LABEL: Record<number, string> = {
  0: 'NONE',
  1: 'SOLVER',
  2: 'VERIFIER',
  3: 'BOTH',
};

export const STATUS_LABEL: Record<number, string> = {
  0: 'OPEN',
  1: 'FINALIZED',
  2: 'REFUNDED',
};

export interface Deployment {
  AgentRegistry: `0x${string}`;
  Reputation: `0x${string}`;
  ProblemRegistry: `0x${string}`;
  FactorChecker: `0x${string}`;
  PowChecker: `0x${string}`;
  BountyEscrow: `0x${string}`;
  deployer: `0x${string}`;
  chainId?: number;
}

export interface AgentView {
  id: number;
  owner: `0x${string}`;
  name: string;
  role: Role;
  stake: bigint;
  spendBudget: bigint;
  maxPerTx: bigint;
  paused: boolean;
  allowlistEnabled: boolean;
  metaRoot: string;
}

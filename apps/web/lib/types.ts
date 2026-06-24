// Client-safe shared response types (no node imports).

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

export interface AgentRow {
  id: number;
  name: string;
  owner: string;
  role: string;
  faction: 'honest' | 'cabal' | 'neutral';
  stakeEth: string;
  stakeWei: string;
  consensus: number;
  incentive: number;
  dividend: number;
  earnedEth: string;
  repScore: number;
  solves: number;
  paused: boolean;
}

export interface Submission {
  id: number;
  bountyId: number;
  agentId: number;
  agentName: string;
  artifactRoot: string;
  consensus: number; // 0..1, peer-review alignment of this submission
  verifierCount: number;
  isWinner: boolean;
}

export interface BountyRow {
  id: number;
  problemId: number;
  title: string;
  category: string;
  vtype: 'Deterministic' | 'Peer';
  status: string;
  phase: number; // 0 submit/commit, 1 reveal, 2 ready, 3 closed
  rewardEth: string;
  winningSubmissionId: number;
  submissions: number;
  submissionList: Submission[];
}

export interface ProblemRow {
  id: number;
  title: string;
  category: string;
  vtype: string;
  spec: string;
  specRoot: string;
}

export interface StateResponse {
  ok: boolean;
  error?: string;
  env: string;
  epoch: number;
  storageKind: string;
  totalAgents: number;
  totalStakedEth: string;
  agents: AgentRow[];
  bounties: BountyRow[];
  problems: ProblemRow[];
  collusion: { cabalPct: number; series: number[] };
  addresses: Deployment | null;
  chainId: number;
}

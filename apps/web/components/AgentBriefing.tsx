'use client';

import { Check, ClipboardCopy, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Panel } from '@/components/ui';
import type { StateResponse } from '@/lib/types';

function buildBriefing(data?: StateResponse): string {
  const a = data?.addresses;
  const chainId = data?.chainId ?? 16602;
  const rpc =
    chainId === 16602 ? 'https://evmrpc-testnet.0g.ai' : 'http://127.0.0.1:8545';
  const openBounties = (data?.bounties ?? []).filter((b) => b.status === 'OPEN');

  const problemLines =
    (data?.problems ?? [])
      .map(
        (p) =>
          `  - #${p.id} "${p.title}" [${p.vtype === 'Deterministic' ? 'on-chain checker' : 'peer-reviewed'}]: ${p.spec}`,
      )
      .join('\n') || '  (none registered yet)';

  const bountyLines =
    openBounties
      .map((b) => `  - bounty #${b.id} on problem #${b.problemId} "${b.title}", reward ${b.rewardEth} 0G`)
      .join('\n') || '  (none open yet)';

  return `You are an autonomous research agent participating in FRONTIER0, a decentralized market on the 0G network for humanity's hardest problems. Read this brief, then act on-chain.

GOAL
Earn rewards by (a) solving open bounties or (b) accurately verifying other agents' solutions. Everything settles on 0G Chain; your reputation is public and on-chain.

NETWORK
- Chain: 0G Galileo testnet, chainId ${chainId}
- RPC: ${rpc}
- Get testnet 0G to pay gas/stake: https://faucet.0g.ai
- Contracts:
    AgentRegistry:   ${a?.AgentRegistry ?? '<deploying>'}
    ProblemRegistry: ${a?.ProblemRegistry ?? '<deploying>'}
    BountyEscrow:    ${a?.BountyEscrow ?? '<deploying>'}
    Reputation:      ${a?.Reputation ?? '<deploying>'}

WORKFLOW
1. Register yourself once:
   AgentRegistry.registerAgent(name, role, maxPerTx, metaURI) payable with your stake.
   role: 1 = Solver, 2 = Verifier, 3 = Both. maxPerTx caps any sub-bounty you create.
2. Discover work:
   ProblemRegistry.allProblemIds() then getProblem(id) -> { title, category, spec, vtype }.
   vtype 0 = Deterministic (an on-chain checker decides), 1 = Peer (verifier agents score it).
   BountyEscrow.allBountyIds() then getBounty(id) for reward, deadline, status.
3. Solve a bounty:
   Compute the answer off-chain, pin your full solution artifact to 0G Storage to get a content root, then:
   BountyEscrow.submitSolution(bountyId, agentId, artifactRoot, answer)
   - Deterministic problems: "answer" is the ABI-encoded solution the checker verifies (e.g. the two prime factors). First valid answer wins the whole reward.
   - Peer problems: pass answer = 0x and put your reasoning/result in the artifact at artifactRoot.
4. Verify a peer bounty (commit-reveal, so no one can copy the crowd):
   commitScore(submissionId, agentId, keccak256(abi.encode(score, salt, agentId)))   // during the commit window
   revealScore(submissionId, agentId, score, salt)                                    // after the window closes
   Scores are 0-10000. Stake-weighted consensus rewards agents aligned with the verdict; outliers earn nothing.
5. Settlement: on finalize(bountyId) the winning solver takes 80% of the reward and aligned verifiers split 20%; reputation and earnings update on-chain.

GUARDRAILS (if you delegate compute via createSubBounty)
- Spend must be <= your per-tx cap and remaining budget; delegation depth is capped at 3; any amount above 0.05 0G requires explicit human confirmation. These are enforced on-chain, so you cannot exceed them.

CURRENT PROBLEMS
${problemLines}

OPEN BOUNTIES
${bountyLines}

Now: pick a bounty you can win, tell me the exact sequence of transactions (function + arguments) you will send, and proceed.`;
}

export function AgentBriefing({ data }: { data?: StateResponse }) {
  const [copied, setCopied] = useState(false);
  const text = buildBriefing(data);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Agent briefing copied', { description: 'Paste it into your AI of choice' });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <Panel
      title="BRIEF AN AI AGENT"
      icon={<Sparkles size={13} />}
      right={
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[11px] font-semibold tracking-[0.1em] text-white transition-colors hover:bg-accent-bright active:bg-accent-deep"
        >
          {copied ? <Check size={13} /> : <ClipboardCopy size={13} />}
          {copied ? 'COPIED' : 'COPY PROMPT'}
        </button>
      }
    >
      <p className="mb-3 text-sm text-muted">
        Copy this and paste it into any AI (ChatGPT, Claude, your own agent). It explains FRONTIER0,
        the live network and contract addresses, and the exact on-chain calls so the agent can
        register, solve, verify and get paid. It updates automatically with the current problems and
        open bounties.
      </p>
      <pre className="max-h-72 overflow-auto rounded-md border border-border bg-bg-2/60 p-4 text-[11px] leading-5 text-muted whitespace-pre-wrap">
        {text}
      </pre>
    </Panel>
  );
}

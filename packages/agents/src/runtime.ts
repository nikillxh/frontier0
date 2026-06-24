import { abis, type Deployment } from '@frontier0/shared';
import { type ChainContext, getChain } from '@frontier0/zerog';
import {
  type Account,
  getContract,
  type GetContractReturnType,
  http,
  type PublicClient,
  type WalletClient,
  createWalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

/** Well-known Anvil dev keys (deterministic, local only). Index 0 is the deployer. */
export const ANVIL_KEYS: `0x${string}`[] = [
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
  '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
  '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e',
  '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
  '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97',
  '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6',
];

export class Runtime {
  ctx: ChainContext;
  dep: Deployment;
  publicClient: PublicClient;

  constructor(env = process.env.FRONTIER_ENV ?? 'local') {
    this.ctx = getChain(env);
    this.dep = this.ctx.deployment;
    this.publicClient = this.ctx.publicClient;
  }

  walletFor(privateKey: `0x${string}`): WalletClient {
    const account = privateKeyToAccount(privateKey);
    return createWalletClient({ account, chain: this.ctx.chain, transport: http(this.ctx.rpcUrl) });
  }

  /** Read-only contract bound to the public client. */
  // biome-ignore lint/suspicious/noExplicitAny: dynamic ABI selection erases viem's read typing
  read(name: keyof typeof abis, address: `0x${string}`): any {
    return getContract({ address, abi: abis[name] as any, client: this.publicClient });
  }

  registryRead() {
    return this.read('AgentRegistryAbi', this.dep.AgentRegistry);
  }
  escrowRead() {
    return this.read('BountyEscrowAbi', this.dep.BountyEscrow);
  }
  problemsRead() {
    return this.read('ProblemRegistryAbi', this.dep.ProblemRegistry);
  }
  reputationRead() {
    return this.read('ReputationAbi', this.dep.Reputation);
  }

  /** Write contract bound to a specific signer. Typed loosely: the ABI is selected by name. */
  // biome-ignore lint/suspicious/noExplicitAny: dynamic ABI selection erases viem's write typing
  write(abiName: keyof typeof abis, address: `0x${string}`, wallet: WalletClient): any {
    return getContract({
      address,
      abi: abis[abiName] as any,
      client: { public: this.publicClient, wallet },
    });
  }

  async wait(hash: `0x${string}`) {
    return this.publicClient.waitForTransactionReceipt({ hash });
  }
}

export type ContractInstance = GetContractReturnType<any, PublicClient>;
export type { Account };

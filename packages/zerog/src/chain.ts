import { ANVIL, GALILEO, loadDeployment } from '@frontier0/shared';
import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export interface ChainContext {
  env: string;
  chain: typeof ANVIL | typeof GALILEO;
  rpcUrl: string;
  publicClient: PublicClient;
  deployment: ReturnType<typeof loadDeployment>;
}

export function getChain(env = process.env.FRONTIER_ENV ?? 'local'): ChainContext {
  const isTestnet = env === 'testnet';
  const chain = isTestnet ? GALILEO : ANVIL;
  const rpcUrl = isTestnet
    ? (process.env.TESTNET_RPC_URL ?? GALILEO.rpcUrls.default.http[0])
    : (process.env.LOCAL_RPC_URL ?? ANVIL.rpcUrls.default.http[0]);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) }) as PublicClient;
  return { env, chain, rpcUrl, publicClient, deployment: loadDeployment(env) };
}

export function makeWallet(privateKey: string, ctx: ChainContext): WalletClient {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return createWalletClient({ account, chain: ctx.chain, transport: http(ctx.rpcUrl) });
}

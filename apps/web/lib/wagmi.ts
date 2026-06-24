'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';

export const anvil = defineChain({
  id: 31337,
  name: 'Anvil Local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
});

export const galileo = defineChain({
  id: 16602,
  name: '0G Galileo Testnet',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: { default: { http: ['https://evmrpc-testnet.0g.ai'] } },
  blockExplorers: { default: { name: 'Chainscan', url: 'https://chainscan-galileo.0g.ai' } },
});

export const wagmiConfig = getDefaultConfig({
  appName: 'FRONTIER0',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID || 'frontier0-local-demo',
  chains: [anvil, galileo],
  ssr: true,
});

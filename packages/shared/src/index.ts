export * from './types';
export * from './yuma';
export * from './problems';
export * from './addresses';
export * as abis from './abis/index';

/** 0G Galileo testnet chain definition (for viem). */
export const GALILEO = {
  id: 16602,
  name: '0G Galileo Testnet',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: { default: { http: ['https://evmrpc-testnet.0g.ai'] } },
  blockExplorers: { default: { name: 'Chainscan', url: 'https://chainscan-galileo.0g.ai' } },
} as const;

export const ANVIL = {
  id: 31337,
  name: 'Anvil Local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
} as const;

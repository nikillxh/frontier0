import { LocalCompute } from './local/compute.js';
import { LocalStorage } from './local/storage.js';
import type { StorageAdapter, ZeroG } from './types.js';

export * from './types.js';
export * from './chain.js';

/**
 * Returns the 0G service surface for the current environment. `local` uses offline mocks
 * so the whole product runs on localhost; `testnet` uses real 0G Compute + Storage.
 */
export async function getZeroG(env = process.env.FRONTIER_ENV ?? 'local'): Promise<ZeroG> {
  if (env === 'testnet') {
    const { ZgRouterCompute } = await import('./testnet/compute.js');
    const { ZgStorage } = await import('./testnet/storage.js');
    return { env, compute: new ZgRouterCompute(), storage: new ZgStorage() };
  }
  return { env, compute: new LocalCompute(), storage: new LocalStorage() };
}

/**
 * Storage-only factory. Useful when you need 0G Storage without a Compute API key
 * (e.g. seeding problem specs). Throws only if the testnet storage prerequisites are missing.
 */
export async function getStorage(
  env = process.env.FRONTIER_ENV ?? 'local',
): Promise<StorageAdapter> {
  if (env === 'testnet') {
    const { ZgStorage } = await import('./testnet/storage.js');
    return new ZgStorage();
  }
  return new LocalStorage();
}

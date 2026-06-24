import type { StorageAdapter, StoredRef } from '../types.js';

/**
 * Real 0G Storage via @0gfoundation/0g-storage-ts-sdk (turbo indexer). The SDK is loaded
 * dynamically so the package installs and runs in local mode without it present.
 */
export class ZgStorage implements StorageAdapter {
  readonly kind = 'zg-storage';
  private indexerRpc: string;
  private evmRpc: string;
  private privateKey: string;

  constructor(opts?: { indexerRpc?: string; evmRpc?: string; privateKey?: string }) {
    this.indexerRpc =
      opts?.indexerRpc ??
      process.env.ZG_STORAGE_INDEXER ??
      'https://indexer-storage-testnet-turbo.0g.ai';
    this.evmRpc = opts?.evmRpc ?? process.env.TESTNET_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
    this.privateKey = opts?.privateKey ?? process.env.TESTNET_PRIVATE_KEY ?? '';
    if (!this.privateKey) throw new Error('TESTNET_PRIVATE_KEY required for 0G Storage uploads');
  }

  private async sdk() {
    const mod: any = await import('@0gfoundation/0g-storage-ts-sdk').catch(() => {
      throw new Error('Install @0gfoundation/0g-storage-ts-sdk to use testnet storage');
    });
    const ethers: any = await import('ethers');
    const provider = new ethers.JsonRpcProvider(this.evmRpc);
    const signer = new ethers.Wallet(this.privateKey, provider);
    const indexer = new mod.Indexer(this.indexerRpc);
    return { mod, indexer, signer };
  }

  async put(data: string | Uint8Array): Promise<StoredRef> {
    const { mod, indexer, signer } = await this.sdk();
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const memData = new mod.MemData(bytes);
    const [tree, treeErr] = await memData.merkleTree();
    if (treeErr) throw new Error(`merkleTree: ${treeErr}`);
    const root: string = tree.rootHash();
    const [, uploadErr] = await indexer.upload(memData, this.evmRpc, signer);
    if (uploadErr) throw new Error(`upload: ${uploadErr}`);
    return { root, uri: `zg://${root}` };
  }

  async get(root: string): Promise<Uint8Array> {
    const { indexer } = await this.sdk();
    const [blob, err] = await indexer.downloadToBlob(root, { proof: true });
    if (err) throw new Error(`download: ${err}`);
    return new Uint8Array(await blob.arrayBuffer());
  }
}

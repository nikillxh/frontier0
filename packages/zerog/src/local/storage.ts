import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { StorageAdapter, StoredRef } from '../types.js';

/**
 * Local mock of 0G Storage: content-addressed files under .frontier/storage.
 * The "root" is a sha256 hash, mirroring 0G Storage's merkle-root addressing.
 */
export class LocalStorage implements StorageAdapter {
  readonly kind = 'local-fs';
  private dir: string;

  constructor(baseDir = resolve(process.cwd(), '.frontier/storage')) {
    this.dir = baseDir;
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });
  }

  async put(data: string | Uint8Array): Promise<StoredRef> {
    const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data);
    const root = `0x${createHash('sha256').update(buf).digest('hex')}`;
    writeFileSync(resolve(this.dir, `${root}.bin`), buf);
    return { root, uri: `localfs://${root}` };
  }

  async get(root: string): Promise<Uint8Array> {
    const path = resolve(this.dir, `${root}.bin`);
    if (!existsSync(path)) throw new Error(`Local storage miss for ${root}`);
    return new Uint8Array(readFileSync(path));
  }
}

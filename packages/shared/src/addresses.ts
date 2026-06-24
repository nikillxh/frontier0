import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Deployment } from './types';

const here = dirname(fileURLToPath(import.meta.url));
// repo root is packages/shared/src -> ../../..
export const REPO_ROOT = resolve(here, '../../..');

export function deploymentPath(env: string): string {
  const name = env === 'testnet' ? 'testnet.json' : 'local.json';
  return resolve(REPO_ROOT, 'deployments', name);
}

export function loadDeployment(env = process.env.FRONTIER_ENV ?? 'local'): Deployment {
  const path = deploymentPath(env);
  if (!existsSync(path)) {
    throw new Error(`No deployment found at ${path}. Deploy contracts first (./scripts/dev.sh).`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as Deployment;
}

export function tryLoadDeployment(env = process.env.FRONTIER_ENV ?? 'local'): Deployment | null {
  try {
    return loadDeployment(env);
  } catch {
    return null;
  }
}

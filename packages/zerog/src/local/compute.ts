import { createHash } from 'node:crypto';
import type { ComputeAdapter, InferenceRequest, InferenceResult } from '../types.js';

/**
 * Local mock of 0G Compute. Deterministic, offline, and returns a "mock" attestation
 * so the full pipeline (and the verified badge) works on localhost. On testnet this is
 * swapped for the real TEE-attested Router adapter.
 */
export class LocalCompute implements ComputeAdapter {
  readonly kind = 'local-mock';

  async infer(req: InferenceRequest): Promise<InferenceResult> {
    const h = createHash('sha256')
      .update((req.system ?? '') + '\n' + req.prompt)
      .digest('hex');
    const content =
      `[local-mock inference]\n` +
      `Deterministic response derived from prompt digest ${h.slice(0, 16)}.\n` +
      `On testnet this is produced inside a TEE on 0G Compute and TEE-attested.`;
    return {
      content,
      model: 'local-mock/deterministic',
      attestation: { verified: true, mode: 'mock', chatId: h.slice(0, 32) },
    };
  }
}

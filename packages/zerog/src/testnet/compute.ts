import type { ComputeAdapter, InferenceRequest, InferenceResult } from '../types.js';

/**
 * Real 0G Compute via the Router (OpenAI-compatible) path. A single endpoint + API key,
 * with opt-in TEE attestation (`verify_tee`). Falls back gracefully if the endpoint omits
 * attestation metadata.
 */
export class ZgRouterCompute implements ComputeAdapter {
  readonly kind = 'zg-router';
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private verifyTee: boolean;

  constructor(opts?: { baseUrl?: string; apiKey?: string; model?: string; verifyTee?: boolean }) {
    this.baseUrl = (opts?.baseUrl ?? process.env.ZG_COMPUTE_BASE_URL ?? '').replace(/\/$/, '');
    this.apiKey = opts?.apiKey ?? process.env.ZG_COMPUTE_API_KEY ?? '';
    this.model = opts?.model ?? process.env.ZG_COMPUTE_MODEL ?? 'qwen/qwen-2.5-7b-instruct';
    this.verifyTee = opts?.verifyTee ?? process.env.ZG_COMPUTE_VERIFY_TEE !== 'false';
    if (!this.baseUrl || !this.apiKey) {
      throw new Error(
        'ZG_COMPUTE_BASE_URL and ZG_COMPUTE_API_KEY are required for testnet compute. Get them from https://pc.0g.ai',
      );
    }
  }

  async infer(req: InferenceRequest): Promise<InferenceResult> {
    const messages = [
      ...(req.system ? [{ role: 'system', content: req.system }] : []),
      { role: 'user', content: req.prompt },
    ];
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: req.temperature ?? 0.2,
        ...(this.verifyTee ? { verify_tee: true } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`0G Compute Router error ${res.status}: ${await res.text()}`);
    }
    const data: any = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    const chatId: string | undefined = res.headers.get('ZG-Res-Key') ?? data?.id;
    // Router returns TEE proof metadata when verify_tee is requested; shape may vary.
    const tee = data?.verify_tee ?? data?.tee ?? data?.attestation;
    const verified = this.verifyTee ? Boolean(tee?.verified ?? tee?.valid ?? tee) : false;
    return {
      content,
      model: data?.model ?? this.model,
      attestation: {
        verified,
        mode: 'router',
        provider: tee?.provider ?? data?.provider,
        chatId,
        raw: tee,
      },
    };
  }
}

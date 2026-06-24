/** Attestation that an inference response came from a genuine TEE provider. */
export interface TeeAttestation {
  verified: boolean;
  mode: string; // "mock" | "tee-ml" | "tee-tls" | "router"
  provider?: string;
  chatId?: string;
  raw?: unknown;
}

export interface InferenceResult {
  content: string;
  model: string;
  attestation: TeeAttestation;
}

export interface InferenceRequest {
  system?: string;
  prompt: string;
  temperature?: number;
}

export interface ComputeAdapter {
  readonly kind: string;
  infer(req: InferenceRequest): Promise<InferenceResult>;
}

export interface StoredRef {
  root: string;
  uri: string;
}

export interface StorageAdapter {
  readonly kind: string;
  put(data: string | Uint8Array, name?: string): Promise<StoredRef>;
  get(root: string): Promise<Uint8Array>;
}

export interface ZeroG {
  env: string;
  compute: ComputeAdapter;
  storage: StorageAdapter;
}

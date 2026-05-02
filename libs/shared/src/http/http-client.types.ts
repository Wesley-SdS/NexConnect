export type HttpRequestBody =
  | string
  | Buffer
  | URLSearchParams
  | FormData
  | Uint8Array
  | undefined;

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
  headers?: Record<string, string>;
  body?: HttpRequestBody;
  query?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
  retry?: Partial<RetryPolicy>;
  parseJson?: boolean;
  signal?: AbortSignal;
}

export interface RetryPolicy {
  maxAttempts: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryOnStatuses: number[];
  retryOnNetworkError: boolean;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = Object.freeze({
  maxAttempts: 4,
  initialBackoffMs: 500,
  maxBackoffMs: 15_000,
  backoffMultiplier: 2,
  jitter: true,
  retryOnStatuses: [408, 425, 429, 500, 502, 503, 504],
  retryOnNetworkError: true,
});

export interface HttpResponse<T = unknown> {
  status: number;
  ok: boolean;
  headers: Headers;
  data: T;
  raw: Response;
  attempts: number;
  durationMs: number;
}

export class HttpClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: unknown,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'HttpClientError';
  }
}

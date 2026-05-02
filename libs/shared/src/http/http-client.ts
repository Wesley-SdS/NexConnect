import { Logger } from '@nestjs/common';
import { CircuitBreaker, CircuitBreakerOpenError } from '../resilience/circuit-breaker';
import {
  HttpClientError,
  HttpRequestOptions,
  HttpResponse,
  RetryPolicy,
} from './http-client.types';
import { computeBackoffMs, resolveRetryPolicy, sleep } from './retry.strategy';

export interface HttpClientOptions {
  name: string;
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
  defaultTimeoutMs?: number;
  defaultRetry?: Partial<RetryPolicy>;
  circuitBreaker?: {
    failureThreshold?: number;
    resetTimeoutMs?: number;
  };
}

export class HttpClient {
  private readonly logger: Logger;
  private readonly breaker: CircuitBreaker;
  private readonly defaultTimeoutMs: number;

  constructor(private readonly options: HttpClientOptions) {
    this.logger = new Logger(`HttpClient:${options.name}`);
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 30_000;
    this.breaker = new CircuitBreaker({
      name: options.name,
      failureThreshold: options.circuitBreaker?.failureThreshold ?? 10,
      resetTimeoutMs: options.circuitBreaker?.resetTimeoutMs ?? 30_000,
    });
  }

  async request<T = unknown>(path: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    const url = this.buildUrl(path, options.query);
    const policy = resolveRetryPolicy({
      ...this.options.defaultRetry,
      ...options.retry,
    });
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;

    let lastError: unknown;

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      const started = Date.now();
      try {
        const response = await this.breaker.execute(() =>
          this.executeSingleRequest(url, options, attempt, timeoutMs),
        );
        const durationMs = Date.now() - started;

        if (response.ok) {
          return await this.parseResponse<T>(response, durationMs, attempt, options);
        }

        if (!policy.retryOnStatuses.includes(response.status) || attempt === policy.maxAttempts) {
          return await this.parseResponse<T>(response, durationMs, attempt, options);
        }

        const retryAfter = response.headers.get('retry-after');
        const backoff = computeBackoffMs(attempt, policy, retryAfter);

        this.logger.warn(
          { url, status: response.status, attempt, backoff },
          'http.request.retrying',
        );

        await sleep(backoff, options.signal);
      } catch (error) {
        lastError = error;

        if (error instanceof CircuitBreakerOpenError) {
          throw new HttpClientError(
            `Circuit breaker open for ${this.options.name}`,
            undefined,
            undefined,
            error,
          );
        }

        if (!policy.retryOnNetworkError || attempt === policy.maxAttempts) {
          throw new HttpClientError(
            `HTTP request failed after ${attempt} attempt(s): ${(error as Error).message}`,
            undefined,
            undefined,
            error,
          );
        }

        const backoff = computeBackoffMs(attempt, policy);
        this.logger.warn(
          { url, attempt, backoff, error: (error as Error).message },
          'http.request.network-error.retrying',
        );
        await sleep(backoff, options.signal);
      }
    }

    throw new HttpClientError(
      `HTTP request exhausted retries`,
      undefined,
      undefined,
      lastError,
    );
  }

  async get<T>(path: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  async post<T>(
    path: string,
    body?: HttpRequestOptions['body'] | Record<string, unknown>,
    options?: HttpRequestOptions,
  ): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'POST', body: this.encodeBody(body, options) });
  }

  async put<T>(
    path: string,
    body?: HttpRequestOptions['body'] | Record<string, unknown>,
    options?: HttpRequestOptions,
  ): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'PUT', body: this.encodeBody(body, options) });
  }

  async patch<T>(
    path: string,
    body?: HttpRequestOptions['body'] | Record<string, unknown>,
    options?: HttpRequestOptions,
  ): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'PATCH', body: this.encodeBody(body, options) });
  }

  async delete<T>(path: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  private encodeBody(
    body: unknown,
    _options?: HttpRequestOptions,
  ): HttpRequestOptions['body'] {
    if (body === undefined || body === null) {
      return undefined;
    }
    if (
      typeof body === 'string' ||
      body instanceof URLSearchParams ||
      Buffer.isBuffer(body) ||
      body instanceof FormData ||
      body instanceof Uint8Array
    ) {
      return body as HttpRequestOptions['body'];
    }
    return JSON.stringify(body);
  }

  private async executeSingleRequest(
    url: string,
    options: HttpRequestOptions,
    attempt: number,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const headers = this.buildHeaders(options);
      this.logger.debug(
        { url, method: options.method ?? 'GET', attempt },
        'http.request.start',
      );

      return await fetch(url, {
        method: options.method ?? 'GET',
        headers,
        body: options.body as RequestInit['body'],
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }
  }

  private async parseResponse<T>(
    response: Response,
    durationMs: number,
    attempts: number,
    options: HttpRequestOptions,
  ): Promise<HttpResponse<T>> {
    const parseJson = options.parseJson ?? true;
    let data: unknown;

    const contentType = response.headers.get('content-type') ?? '';
    if (parseJson && contentType.includes('application/json')) {
      const text = await response.text();
      data = text.length ? JSON.parse(text) : undefined;
    } else if (parseJson && contentType.includes('application/xml')) {
      data = await response.text();
    } else if (contentType.includes('text/')) {
      data = await response.text();
    } else if (!parseJson) {
      data = Buffer.from(await response.arrayBuffer());
    } else {
      const text = await response.text();
      data = text;
    }

    return {
      status: response.status,
      ok: response.ok,
      headers: response.headers,
      data: data as T,
      raw: response,
      attempts,
      durationMs,
    };
  }

  private buildUrl(path: string, query?: HttpRequestOptions['query']): string {
    const base = path.startsWith('http://') || path.startsWith('https://')
      ? path
      : `${(this.options.baseUrl ?? '').replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

    if (!query) return base;

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    }
    const queryString = params.toString();
    if (!queryString) return base;

    return base.includes('?') ? `${base}&${queryString}` : `${base}?${queryString}`;
  }

  private buildHeaders(options: HttpRequestOptions): Record<string, string> {
    return {
      Accept: 'application/json',
      ...(this.options.defaultHeaders ?? {}),
      ...(options.headers ?? {}),
    };
  }
}

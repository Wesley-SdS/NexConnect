import { request } from 'undici';
import { mapHttpError, NexConnectApiError } from './errors';

export interface HttpClientOptions {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  maxRetries: number;
}

interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
}

const RETRYABLE_STATUS_CODES = new Set([500, 502, 503, 504]);
const DEFAULT_BACKOFF_BASE_MS = 500;

export class HttpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.timeout = options.timeout;
    this.maxRetries = options.maxRetries;
  }

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.execute<T>('GET', path, options);
  }

  async post<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.execute<T>('POST', path, options);
  }

  async patch<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.execute<T>('PATCH', path, options);
  }

  async put<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.execute<T>('PUT', path, options);
  }

  async delete<T = void>(path: string, options?: RequestOptions): Promise<T> {
    return this.execute<T>('DELETE', path, options);
  }

  private buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private async execute<T>(
    method: string,
    path: string,
    options?: RequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(path, options?.query);
    let lastError: NexConnectApiError | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = DEFAULT_BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
        const jitter = Math.random() * delay * 0.25;
        await this.sleep(delay + jitter);
      }

      try {
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': '@nexconnect/sdk/1.0.0',
          ...options?.headers,
        };

        const response = await request(url, {
          method: method as 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
          headers,
          body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
          bodyTimeout: this.timeout,
          headersTimeout: this.timeout,
        });

        const responseHeaders: Record<string, string> = {};
        for (const [key, value] of Object.entries(response.headers)) {
          if (typeof value === 'string') {
            responseHeaders[key.toLowerCase()] = value;
          }
        }

        if (response.statusCode >= 200 && response.statusCode < 300) {
          if (response.statusCode === 204) {
            return undefined as T;
          }
          const text = await response.body.text();
          if (!text) {
            return undefined as T;
          }
          return JSON.parse(text) as T;
        }

        const errorText = await response.body.text();
        let errorBody: Record<string, unknown>;
        try {
          errorBody = JSON.parse(errorText);
        } catch {
          errorBody = { message: errorText || `HTTP ${response.statusCode}` };
        }

        const error = mapHttpError(response.statusCode, errorBody, responseHeaders);

        if (RETRYABLE_STATUS_CODES.has(response.statusCode) && attempt < this.maxRetries) {
          lastError = error;
          continue;
        }

        throw error;
      } catch (err) {
        if (err instanceof NexConnectApiError) {
          if (RETRYABLE_STATUS_CODES.has(err.statusCode) && attempt < this.maxRetries) {
            lastError = err;
            continue;
          }
          throw err;
        }

        const networkError = new NexConnectApiError(
          0,
          'NETWORK_ERROR',
          err instanceof Error ? err.message : 'Unknown network error',
        );

        if (attempt < this.maxRetries) {
          lastError = networkError;
          continue;
        }

        throw networkError;
      }
    }

    throw lastError ?? new NexConnectApiError(0, 'MAX_RETRIES', 'Max retries reached');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '../http/http-client';
import { HttpClientError } from '../http/http-client.types';

const originalFetch = globalThis.fetch;

function mockResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = { 'content-type': 'application/json' },
): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

describe('HttpClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns ok response on first attempt', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, { ok: true }));
    const client = new HttpClient({ name: 'test', baseUrl: 'https://api.example.com' });
    const res = await client.get('/ping');
    expect(res.status).toBe(200);
    expect(res.attempts).toBe(1);
    expect(res.data).toEqual({ ok: true });
  });

  it('retries on 5xx responses', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(503, {}))
      .mockResolvedValueOnce(mockResponse(503, {}))
      .mockResolvedValueOnce(mockResponse(200, { ok: true }));

    const client = new HttpClient({
      name: 'test',
      baseUrl: 'https://api.example.com',
      defaultRetry: { maxAttempts: 4, initialBackoffMs: 1, maxBackoffMs: 5, jitter: false },
    });
    const res = await client.get<{ ok: true }>('/retry');
    expect(res.attempts).toBe(3);
    expect(res.data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('honors Retry-After header', async () => {
    const start = Date.now();
    fetchMock
      .mockResolvedValueOnce(
        new Response('{}', { status: 429, headers: { 'retry-after': '1', 'content-type': 'application/json' } }),
      )
      .mockResolvedValueOnce(mockResponse(200, { ok: true }));

    const client = new HttpClient({
      name: 'retry-after',
      baseUrl: 'https://api.example.com',
      defaultRetry: { maxAttempts: 2, initialBackoffMs: 10_000, jitter: false },
    });
    const res = await client.get('/');
    expect(res.status).toBe(200);
    expect(Date.now() - start).toBeGreaterThanOrEqual(900);
  }, 10_000);

  it('stops retrying on non-retryable status codes', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(400, { error: 'bad' }));
    const client = new HttpClient({ name: 'no-retry', baseUrl: 'https://api.example.com' });
    const res = await client.get('/');
    expect(res.status).toBe(400);
    expect(res.attempts).toBe(1);
  });

  it('wraps network failures in HttpClientError after exhausting retries', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    const client = new HttpClient({
      name: 'net-fail',
      baseUrl: 'https://api.example.com',
      defaultRetry: { maxAttempts: 2, initialBackoffMs: 1, jitter: false },
    });
    await expect(client.get('/')).rejects.toBeInstanceOf(HttpClientError);
  });

  it('serializes JSON bodies for POST', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(201, { id: 1 }));
    const client = new HttpClient({ name: 'json', baseUrl: 'https://api.example.com' });
    await client.post('/items', { name: 'hello' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/items');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'hello' }));
  });

  it('includes query parameters', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, {}));
    const client = new HttpClient({ name: 'qs', baseUrl: 'https://api.example.com' });
    await client.get('/search', { query: { q: 'hello', page: 2 } });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://api.example.com/search?q=hello&page=2');
  });
});

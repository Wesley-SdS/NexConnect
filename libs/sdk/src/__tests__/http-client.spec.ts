import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from '../http-client';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  NexConnectApiError,
} from '../errors';

vi.mock('undici', () => ({
  request: vi.fn(),
}));

describe('HttpClient', () => {
  let httpClient: HttpClient;
  let mockedRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const undici = await import('undici');
    mockedRequest = vi.mocked(undici.request);
    mockedRequest.mockReset();

    httpClient = new HttpClient({
      baseUrl: 'http://localhost:3000/v1',
      apiKey: 'nex_test_key123',
      timeout: 5000,
      maxRetries: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should set Authorization header with Bearer token', async () => {
    mockedRequest.mockResolvedValueOnce({
      statusCode: 200,
      headers: {},
      body: { text: async () => JSON.stringify({ ok: true }) },
    });

    await httpClient.get('/test');

    expect(mockedRequest).toHaveBeenCalledWith(
      'http://localhost:3000/v1/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer nex_test_key123',
        }),
      }),
    );
  });

  it('should set Content-Type and Accept headers', async () => {
    mockedRequest.mockResolvedValueOnce({
      statusCode: 200,
      headers: {},
      body: { text: async () => JSON.stringify({}) },
    });

    await httpClient.get('/test');

    expect(mockedRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Accept: 'application/json',
        }),
      }),
    );
  });

  it('should set User-Agent header', async () => {
    mockedRequest.mockResolvedValueOnce({
      statusCode: 200,
      headers: {},
      body: { text: async () => JSON.stringify({}) },
    });

    await httpClient.get('/test');

    expect(mockedRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': '@nexconnect/sdk/1.0.0',
        }),
      }),
    );
  });

  it('should map 401 to UnauthorizedError', async () => {
    mockedRequest.mockResolvedValueOnce({
      statusCode: 401,
      headers: {},
      body: { text: async () => JSON.stringify({ message: 'Invalid API key' }) },
    });

    await expect(httpClient.get('/test')).rejects.toThrow(UnauthorizedError);
  });

  it('should map 403 to ForbiddenError', async () => {
    mockedRequest.mockResolvedValueOnce({
      statusCode: 403,
      headers: {},
      body: { text: async () => JSON.stringify({ message: 'Forbidden' }) },
    });

    await expect(httpClient.get('/test')).rejects.toThrow(ForbiddenError);
  });

  it('should map 404 to NotFoundError', async () => {
    mockedRequest.mockResolvedValueOnce({
      statusCode: 404,
      headers: {},
      body: { text: async () => JSON.stringify({ message: 'Not found' }) },
    });

    await expect(httpClient.get('/test')).rejects.toThrow(NotFoundError);
  });

  it('should map 429 to RateLimitError with retryAfter', async () => {
    mockedRequest.mockResolvedValueOnce({
      statusCode: 429,
      headers: { 'retry-after': '30' },
      body: { text: async () => JSON.stringify({ message: 'Too many requests' }) },
    });

    try {
      await httpClient.get('/test');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfter).toBe(30);
    }
  });

  it('should map 400 to ValidationError', async () => {
    mockedRequest.mockResolvedValueOnce({
      statusCode: 400,
      headers: {},
      body: {
        text: async () =>
          JSON.stringify({
            message: 'Validation failed',
            errors: [{ field: 'name', message: 'Name is required' }],
          }),
      },
    });

    try {
      await httpClient.post('/test', { body: {} });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).errors).toHaveLength(1);
      expect((err as ValidationError).errors[0].field).toBe('name');
    }
  });

  it('should map 422 to ValidationError', async () => {
    mockedRequest.mockResolvedValueOnce({
      statusCode: 422,
      headers: {},
      body: { text: async () => JSON.stringify({ message: 'Unprocessable' }) },
    });

    await expect(httpClient.post('/test', { body: {} })).rejects.toThrow(ValidationError);
  });

  it('should map unknown 5xx to NexConnectApiError', async () => {
    mockedRequest.mockResolvedValueOnce({
      statusCode: 500,
      headers: {},
      body: { text: async () => JSON.stringify({ message: 'Internal Server Error' }) },
    });

    await expect(httpClient.get('/test')).rejects.toThrow(NexConnectApiError);
  });

  it('should return undefined for 204 responses', async () => {
    mockedRequest.mockResolvedValueOnce({
      statusCode: 204,
      headers: {},
      body: { text: async () => '' },
    });

    const result = await httpClient.delete('/test');
    expect(result).toBeUndefined();
  });

  it('should parse JSON response body', async () => {
    const responseData = { id: '123', name: 'Test Instance' };
    mockedRequest.mockResolvedValueOnce({
      statusCode: 200,
      headers: {},
      body: { text: async () => JSON.stringify(responseData) },
    });

    const result = await httpClient.get('/test');
    expect(result).toEqual(responseData);
  });

  it('should append query parameters to URL', async () => {
    mockedRequest.mockResolvedValueOnce({
      statusCode: 200,
      headers: {},
      body: { text: async () => JSON.stringify({}) },
    });

    await httpClient.get('/test', { query: { page: 1, limit: 20, status: 'CONNECTED' } });

    const calledUrl = mockedRequest.mock.calls[0][0] as string;
    expect(calledUrl).toContain('page=1');
    expect(calledUrl).toContain('limit=20');
    expect(calledUrl).toContain('status=CONNECTED');
  });

  it('should skip undefined query parameters', async () => {
    mockedRequest.mockResolvedValueOnce({
      statusCode: 200,
      headers: {},
      body: { text: async () => JSON.stringify({}) },
    });

    await httpClient.get('/test', { query: { page: 1, status: undefined } });

    const calledUrl = mockedRequest.mock.calls[0][0] as string;
    expect(calledUrl).toContain('page=1');
    expect(calledUrl).not.toContain('status');
  });

  it('should send JSON body for POST requests', async () => {
    mockedRequest.mockResolvedValueOnce({
      statusCode: 201,
      headers: {},
      body: { text: async () => JSON.stringify({ id: '123' }) },
    });

    await httpClient.post('/test', { body: { name: 'New Instance' } });

    expect(mockedRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ name: 'New Instance' }),
      }),
    );
  });
});

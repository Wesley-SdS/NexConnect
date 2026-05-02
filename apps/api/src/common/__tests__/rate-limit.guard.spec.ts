import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { RateLimitExceededException } from '@nexconnect/shared';

const mockRedisService = {
  incrWithTtl: vi.fn(),
  getClient: vi.fn().mockReturnValue({
    ttl: vi.fn().mockResolvedValue(55),
  }),
};

const mockReflector = {
  getAllAndOverride: vi.fn(),
};

const createMockContext = (
  overrides: {
    apiKeyId?: string;
    params?: Record<string, string>;
    body?: Record<string, unknown>;
    tenant?: { plan?: string };
  } = {},
): { context: ExecutionContext; reply: { header: ReturnType<typeof vi.fn> } } => {
  const reply = { header: vi.fn() };

  const request = {
    headers: { authorization: 'Bearer test-key' },
    apiKeyId: overrides.apiKeyId ?? 'key-001',
    params: overrides.params ?? {},
    body: overrides.body ?? {},
    tenant: overrides.tenant,
  };

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => reply,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;

  return { context, reply };
};

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReflector.getAllAndOverride.mockReturnValue(undefined);
    guard = new RateLimitGuard(mockReflector as never, mockRedisService as never);
  });

  it('allows requests within the API key limit and writes rate-limit headers', async () => {
    mockRedisService.incrWithTtl.mockResolvedValue(1);

    const { context, reply } = createMockContext();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(reply.header).toHaveBeenCalledWith('X-RateLimit-Limit', '1000');
    expect(reply.header).toHaveBeenCalledWith('X-RateLimit-Remaining', '999');
    expect(reply.header).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
  });

  it('throws RateLimitExceededException when the API key limit is breached', async () => {
    mockRedisService.incrWithTtl.mockResolvedValue(1001);

    const { context } = createMockContext();

    await expect(guard.canActivate(context)).rejects.toThrow(RateLimitExceededException);
  });

  it('also enforces the instance limit when instanceId is in the URL', async () => {
    mockRedisService.incrWithTtl.mockResolvedValue(50);

    const { context } = createMockContext({ params: { instanceId: 'ins-001' } });

    await guard.canActivate(context);

    expect(mockRedisService.incrWithTtl).toHaveBeenCalledWith('rl:apikey:key-001', 60);
    expect(mockRedisService.incrWithTtl).toHaveBeenCalledWith('rl:instance:ins-001', 60);
  });

  it('throws when the instance limit is exceeded', async () => {
    mockRedisService.incrWithTtl
      .mockResolvedValueOnce(500) // api key OK
      .mockResolvedValueOnce(101); // instance exceeded

    const { context } = createMockContext({ params: { instanceId: 'ins-001' } });

    await expect(guard.canActivate(context)).rejects.toThrow(RateLimitExceededException);
  });

  it('enforces a per-recipient limit when "to" is in the body and instanceId is set', async () => {
    mockRedisService.incrWithTtl.mockResolvedValue(5);

    const { context } = createMockContext({
      params: { instanceId: 'ins-001' },
      body: { to: '+5511999998888' },
    });

    await guard.canActivate(context);

    expect(mockRedisService.incrWithTtl).toHaveBeenCalledWith(
      'rl:recipient:ins-001:+5511999998888',
      60,
    );
  });

  it('throws when the recipient limit is exceeded', async () => {
    mockRedisService.incrWithTtl
      .mockResolvedValueOnce(100) // api key OK
      .mockResolvedValueOnce(50) // instance OK
      .mockResolvedValueOnce(11); // recipient exceeded

    const { context } = createMockContext({
      params: { instanceId: 'ins-001' },
      body: { to: '+5511999998888' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(RateLimitExceededException);
  });

  it('skips rate limiting for public routes', async () => {
    mockReflector.getAllAndOverride.mockImplementation((key: string) => key === 'isPublic');

    const { context } = createMockContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(mockRedisService.incrWithTtl).not.toHaveBeenCalled();
  });
});

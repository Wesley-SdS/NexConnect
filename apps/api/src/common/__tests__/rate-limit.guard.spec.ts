import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { RateLimitExceededException } from '@nexconnect/shared';

const mockRedisService = {
  incr: vi.fn(),
  expire: vi.fn(),
  getClient: vi.fn().mockReturnValue({
    ttl: vi.fn().mockResolvedValue(55),
  }),
};

const mockReflector = {
  getAllAndOverride: vi.fn(),
};

const createMockContext = (overrides: {
  apiKeyId?: string;
  params?: Record<string, string>;
  body?: Record<string, any>;
} = {}): { context: ExecutionContext; reply: any } => {
  const reply = {
    header: vi.fn(),
  };

  const request = {
    headers: { authorization: 'Bearer test-key' },
    apiKeyId: overrides.apiKeyId ?? 'key-001',
    params: overrides.params ?? {},
    body: overrides.body ?? {},
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
    guard = new RateLimitGuard(mockReflector as any, mockRedisService as any);
  });

  it('should allow requests within API key rate limit', async () => {
    mockRedisService.incr.mockResolvedValue(1);

    const { context, reply } = createMockContext();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(reply.header).toHaveBeenCalledWith('X-RateLimit-Limit', '1000');
    expect(reply.header).toHaveBeenCalledWith('X-RateLimit-Remaining', '999');
  });

  it('should throw RateLimitExceededException when API key limit exceeded', async () => {
    mockRedisService.incr.mockResolvedValue(1001);

    const { context } = createMockContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      RateLimitExceededException,
    );
  });

  it('should check instance rate limit when instanceId is present', async () => {
    mockRedisService.incr.mockResolvedValue(50);

    const { context, reply } = createMockContext({
      params: { instanceId: 'ins-001' },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockRedisService.incr).toHaveBeenCalledWith('rl:apikey:key-001');
    expect(mockRedisService.incr).toHaveBeenCalledWith('rl:instance:ins-001');
  });

  it('should throw when instance rate limit exceeded', async () => {
    mockRedisService.incr
      .mockResolvedValueOnce(500) // api key OK
      .mockResolvedValueOnce(101); // instance exceeded

    const { context } = createMockContext({
      params: { instanceId: 'ins-001' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      RateLimitExceededException,
    );
  });

  it('should check recipient rate limit when "to" is in body', async () => {
    mockRedisService.incr.mockResolvedValue(5);

    const { context } = createMockContext({
      params: { instanceId: 'ins-001' },
      body: { to: '+5511999998888' },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockRedisService.incr).toHaveBeenCalledWith('rl:apikey:key-001');
    expect(mockRedisService.incr).toHaveBeenCalledWith('rl:instance:ins-001');
    expect(mockRedisService.incr).toHaveBeenCalledWith(
      'rl:recipient:ins-001:+5511999998888',
    );
  });

  it('should throw when recipient rate limit exceeded', async () => {
    mockRedisService.incr
      .mockResolvedValueOnce(100) // api key OK
      .mockResolvedValueOnce(50) // instance OK
      .mockResolvedValueOnce(11); // recipient exceeded

    const { context } = createMockContext({
      params: { instanceId: 'ins-001' },
      body: { to: '+5511999998888' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      RateLimitExceededException,
    );
  });

  it('should skip rate limiting for public routes', async () => {
    mockReflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === 'isPublic') return true;
      return undefined;
    });

    const { context } = createMockContext();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockRedisService.incr).not.toHaveBeenCalled();
  });

  it('should set EXPIRE on first request (counter = 1)', async () => {
    mockRedisService.incr.mockResolvedValue(1);

    const { context } = createMockContext();

    await guard.canActivate(context);

    expect(mockRedisService.expire).toHaveBeenCalledWith(
      'rl:apikey:key-001',
      60,
    );
  });

  it('should not set EXPIRE on subsequent requests', async () => {
    mockRedisService.incr.mockResolvedValue(50);

    const { context } = createMockContext();

    await guard.canActivate(context);

    expect(mockRedisService.expire).not.toHaveBeenCalled();
  });

  it('should set X-RateLimit-Reset header', async () => {
    mockRedisService.incr.mockResolvedValue(500);

    const { context, reply } = createMockContext();

    await guard.canActivate(context);

    expect(reply.header).toHaveBeenCalledWith(
      'X-RateLimit-Reset',
      expect.any(String),
    );
  });
});

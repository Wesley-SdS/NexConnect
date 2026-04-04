import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

const mockAuthService = {
  validateApiKey: vi.fn(),
};

const createMockExecutionContext = (authHeader?: string): ExecutionContext => {
  const mockRequest = {
    headers: authHeader ? { authorization: authHeader } : {},
  };

  return {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
};

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new ApiKeyGuard(mockAuthService as any);
  });

  it('should throw UnauthorizedException when no Authorization header', async () => {
    const context = createMockExecutionContext();

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when Bearer token missing', async () => {
    const context = createMockExecutionContext('Basic abc123');

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for invalid API key', async () => {
    mockAuthService.validateApiKey.mockResolvedValue(null);
    const context = createMockExecutionContext('Bearer nc_invalid_key');

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should allow valid API key and set tenant on request', async () => {
    mockAuthService.validateApiKey.mockResolvedValue({
      tenant: { id: 'ten_001', name: 'Test' },
      scopes: ['read', 'send'],
    });
    const context = createMockExecutionContext('Bearer nc_valid_key');

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    const request = context.switchToHttp().getRequest();
    expect((request as any).tenant).toEqual({ id: 'ten_001', name: 'Test' });
    expect((request as any).scopes).toEqual(['read', 'send']);
  });
});

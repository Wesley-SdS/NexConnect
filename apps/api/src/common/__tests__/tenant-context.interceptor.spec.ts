import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantContextInterceptor } from '../interceptors/tenant-context.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, lastValueFrom, throwError } from 'rxjs';

const mockPrismaService = {
  setTenantContext: vi.fn(),
  clearTenantContext: vi.fn(),
};

const createMockExecutionContext = (
  tenant?: { id: string },
): ExecutionContext => {
  const mockRequest: Record<string, unknown> = {};
  if (tenant) {
    mockRequest.tenant = tenant;
  }

  return {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
};

describe('TenantContextInterceptor', () => {
  let interceptor: TenantContextInterceptor;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaService.setTenantContext.mockResolvedValue(undefined);
    mockPrismaService.clearTenantContext.mockResolvedValue(undefined);
    interceptor = new TenantContextInterceptor(mockPrismaService as any);
  });

  it('should set tenant context before handler', async () => {
    const context = createMockExecutionContext({ id: 'ten_001' });
    const handler: CallHandler = { handle: () => of({ ok: true }) };

    await lastValueFrom(interceptor.intercept(context, handler));

    expect(mockPrismaService.setTenantContext).toHaveBeenCalledWith('ten_001');
  });

  it('should clear tenant context after handler completes', async () => {
    const context = createMockExecutionContext({ id: 'ten_001' });
    const handler: CallHandler = { handle: () => of({ ok: true }) };

    await lastValueFrom(interceptor.intercept(context, handler));

    expect(mockPrismaService.clearTenantContext).toHaveBeenCalled();
  });

  it('should clear tenant context on error', async () => {
    const context = createMockExecutionContext({ id: 'ten_001' });
    const handler: CallHandler = {
      handle: () => throwError(() => new Error('Something failed')),
    };

    await expect(
      lastValueFrom(interceptor.intercept(context, handler)),
    ).rejects.toThrow('Something failed');

    expect(mockPrismaService.clearTenantContext).toHaveBeenCalled();
  });

  it('should pass through when no tenant is present', async () => {
    const context = createMockExecutionContext();
    const handler: CallHandler = { handle: () => of({ ok: true }) };

    const result = await lastValueFrom(
      interceptor.intercept(context, handler),
    );

    expect(result).toEqual({ ok: true });
    expect(mockPrismaService.setTenantContext).not.toHaveBeenCalled();
  });
});

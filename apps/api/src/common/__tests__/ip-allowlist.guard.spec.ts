import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IpAllowlistGuard } from '../guards/ip-allowlist.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

const createMockExecutionContext = (
  clientIp: string,
  tenant?: { id: string; settings?: Record<string, unknown> },
): ExecutionContext => {
  const mockRequest = {
    ip: clientIp,
    tenant,
  };

  return {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
};

describe('IpAllowlistGuard', () => {
  let guard: IpAllowlistGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new IpAllowlistGuard();
  });

  it('should allow when IP is in allowlist', () => {
    const context = createMockExecutionContext('192.168.1.100', {
      id: 'ten_001',
      settings: { ipAllowlist: ['192.168.1.100', '10.0.0.1'] },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny when IP is not in allowlist', () => {
    const context = createMockExecutionContext('192.168.1.200', {
      id: 'ten_001',
      settings: { ipAllowlist: ['192.168.1.100', '10.0.0.1'] },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow when no allowlist is configured', () => {
    const context = createMockExecutionContext('192.168.1.200', {
      id: 'ten_001',
      settings: {},
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow when tenant has no settings', () => {
    const context = createMockExecutionContext('192.168.1.200', {
      id: 'ten_001',
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow when no tenant is present', () => {
    const context = createMockExecutionContext('192.168.1.200');

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should support CIDR notation', () => {
    const context = createMockExecutionContext('10.0.0.50', {
      id: 'ten_001',
      settings: { ipAllowlist: ['10.0.0.0/24'] },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny IP outside CIDR range', () => {
    const context = createMockExecutionContext('10.0.1.50', {
      id: 'ten_001',
      settings: { ipAllowlist: ['10.0.0.0/24'] },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});

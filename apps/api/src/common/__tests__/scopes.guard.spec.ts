import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScopesGuard } from '../guards/scopes.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

const mockReflector = {
  getAllAndOverride: vi.fn(),
};

const createMockExecutionContext = (
  apiKeyScopes?: string[],
): ExecutionContext => {
  const mockRequest: Record<string, unknown> = {};
  if (apiKeyScopes) {
    mockRequest.apiKeyScopes = apiKeyScopes;
  }

  return {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
};

describe('ScopesGuard', () => {
  let guard: ScopesGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new ScopesGuard(mockReflector as unknown as Reflector);
  });

  it('should allow when scopes include admin', () => {
    mockReflector.getAllAndOverride
      .mockReturnValueOnce(false) // isPublic
      .mockReturnValueOnce(['messages:send', 'messages:read']); // requiredScopes

    const context = createMockExecutionContext(['admin']);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow when required scopes are present', () => {
    mockReflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['messages:send', 'messages:read']);

    const context = createMockExecutionContext([
      'messages:send',
      'messages:read',
      'contacts:read',
    ]);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny when required scopes are missing', () => {
    mockReflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['messages:send', 'messages:read']);

    const context = createMockExecutionContext(['messages:read']);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow when no scopes are required', () => {
    mockReflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(undefined);

    const context = createMockExecutionContext([]);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow when route is public', () => {
    mockReflector.getAllAndOverride.mockReturnValueOnce(true); // isPublic

    const context = createMockExecutionContext();

    expect(guard.canActivate(context)).toBe(true);
  });
});

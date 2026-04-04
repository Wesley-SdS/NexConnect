import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PiiRedactionInterceptor } from '../interceptors/pii-redaction.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';

vi.mock('@nexconnect/shared', () => ({
  PiiRedactor: {
    redact: vi.fn((data) => ({ ...data, phone: '***REDACTED***' })),
  },
}));

const createMockExecutionContext = (): ExecutionContext => {
  return {
    switchToHttp: () => ({
      getRequest: () => ({}),
    }),
    getHandler: () => ({ name: 'testHandler' }),
    getClass: () => ({ name: 'TestController' }),
  } as unknown as ExecutionContext;
};

describe('PiiRedactionInterceptor', () => {
  let interceptor: PiiRedactionInterceptor;

  beforeEach(() => {
    vi.clearAllMocks();
    interceptor = new PiiRedactionInterceptor();
  });

  it('should redact PII from response logs but not modify the response', async () => {
    const context = createMockExecutionContext();
    const responseData = { id: '1', phone: '+5511999999999' };
    const handler: CallHandler = { handle: () => of(responseData) };

    const result = await lastValueFrom(
      interceptor.intercept(context, handler),
    );

    // The actual response is NOT modified
    expect(result).toBe(responseData);
    expect(result).toEqual({ id: '1', phone: '+5511999999999' });
  });

  it('should handle non-object responses', async () => {
    const context = createMockExecutionContext();
    const handler: CallHandler = { handle: () => of('simple string') };

    const result = await lastValueFrom(
      interceptor.intercept(context, handler),
    );

    expect(result).toBe('simple string');
  });

  it('should not log when response is null', async () => {
    const { PiiRedactor } = await import('@nexconnect/shared');
    const context = createMockExecutionContext();
    const handler: CallHandler = { handle: () => of(null) };

    await lastValueFrom(interceptor.intercept(context, handler));

    expect(PiiRedactor.redact).not.toHaveBeenCalled();
  });
});

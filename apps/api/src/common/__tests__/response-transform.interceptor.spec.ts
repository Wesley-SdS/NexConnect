import { describe, it, expect, vi } from 'vitest';
import { ResponseTransformInterceptor } from '../interceptors/response-transform.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';

const createMockExecutionContext = (): ExecutionContext => {
  return {
    switchToHttp: () => ({
      getRequest: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
};

describe('ResponseTransformInterceptor', () => {
  const interceptor = new ResponseTransformInterceptor();
  const context = createMockExecutionContext();

  it('should wrap response in { success: true, data: T }', async () => {
    const handler: CallHandler = { handle: () => of({ id: '1', name: 'Test' }) };

    const result = await lastValueFrom(interceptor.intercept(context, handler));

    expect(result).toEqual({
      success: true,
      data: { id: '1', name: 'Test' },
    });
  });

  it('should handle null data', async () => {
    const handler: CallHandler = { handle: () => of(null) };

    const result = await lastValueFrom(interceptor.intercept(context, handler));

    expect(result).toEqual({
      success: true,
      data: null,
    });
  });

  it('should handle array data', async () => {
    const handler: CallHandler = {
      handle: () => of([{ id: '1' }, { id: '2' }]),
    };

    const result = await lastValueFrom(interceptor.intercept(context, handler));

    expect(result).toEqual({
      success: true,
      data: [{ id: '1' }, { id: '2' }],
    });
  });
});

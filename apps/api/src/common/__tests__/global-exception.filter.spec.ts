import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from '../filters/global-exception.filter';
import {
  NexConnectException,
  InstanceNotFoundException,
  RateLimitExceededException,
} from '@nexconnect/shared';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: { status: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> };
  let mockRequest: { url: string; method: string; id: string };
  let mockHost: { switchToHttp: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    filter = new GlobalExceptionFilter();

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    mockRequest = {
      url: '/v1/instances/123',
      method: 'GET',
      id: 'req-abc',
    };

    mockHost = {
      switchToHttp: vi.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };
  });

  it('should handle NexConnectException with correct errorCode', () => {
    const exception = new InstanceNotFoundException('inst-123');

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        error: 'INSTANCE_NOT_FOUND',
        message: 'Instance inst-123 not found',
        path: '/v1/instances/123',
        requestId: 'req-abc',
      }),
    );
  });

  it('should handle RateLimitExceededException', () => {
    const exception = new RateLimitExceededException('Too fast');

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
    expect(mockResponse.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'RATE_LIMIT_EXCEEDED',
      }),
    );
  });

  it('should handle standard HttpException', () => {
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Not Found',
      }),
    );
  });

  it('should handle HttpException with object response', () => {
    const exception = new HttpException(
      { message: 'Validation failed', error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        error: 'Bad Request',
      }),
    );
  });

  it('should handle generic Error as 500', () => {
    const exception = new Error('Something broke');

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Something broke',
        error: 'Error',
      }),
    );
  });

  it('should handle unknown exception as 500', () => {
    filter.catch('unknown error', mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      }),
    );
  });

  it('should include timestamp in all responses', () => {
    filter.catch(new Error('test'), mockHost as any);

    const sentBody = mockResponse.send.mock.calls[0][0];
    expect(sentBody.timestamp).toBeDefined();
    expect(() => new Date(sentBody.timestamp)).not.toThrow();
  });
});

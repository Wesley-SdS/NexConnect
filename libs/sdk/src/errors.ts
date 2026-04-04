/**
 * Base error class for all NexConnect API errors.
 */
export class NexConnectApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly requestId?: string;

  constructor(statusCode: number, code: string, message: string, requestId?: string) {
    super(message);
    this.name = 'NexConnectApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.requestId = requestId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the request body or parameters fail validation (400 or 422).
 */
export class ValidationError extends NexConnectApiError {
  public readonly errors: ValidationFieldError[];

  constructor(
    message: string,
    errors: ValidationFieldError[] = [],
    statusCode: number = 400,
    requestId?: string,
  ) {
    super(statusCode, 'VALIDATION_ERROR', message, requestId);
    this.name = 'ValidationError';
    this.errors = errors;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface ValidationFieldError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Thrown when the API key is missing or invalid (401).
 */
export class UnauthorizedError extends NexConnectApiError {
  constructor(message: string = 'Invalid or missing API key', requestId?: string) {
    super(401, 'UNAUTHORIZED', message, requestId);
    this.name = 'UnauthorizedError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the API key lacks permission for the requested resource (403).
 */
export class ForbiddenError extends NexConnectApiError {
  constructor(message: string = 'Insufficient permissions', requestId?: string) {
    super(403, 'FORBIDDEN', message, requestId);
    this.name = 'ForbiddenError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the requested resource does not exist (404).
 */
export class NotFoundError extends NexConnectApiError {
  constructor(message: string = 'Resource not found', requestId?: string) {
    super(404, 'NOT_FOUND', message, requestId);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the rate limit has been exceeded (429).
 * Contains `retryAfter` indicating seconds until the limit resets.
 */
export class RateLimitError extends NexConnectApiError {
  public readonly retryAfter: number;

  constructor(retryAfter: number, message?: string, requestId?: string) {
    super(
      429,
      'RATE_LIMIT_EXCEEDED',
      message ?? `Rate limit exceeded. Retry after ${retryAfter} seconds`,
      requestId,
    );
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Maps an HTTP status code and response body to the appropriate error class.
 */
export function mapHttpError(
  statusCode: number,
  body: Record<string, unknown>,
  headers?: Record<string, string>,
): NexConnectApiError {
  const message = (body.message as string) ?? (body.error as string) ?? 'Unknown API error';
  const requestId = body.requestId as string | undefined;

  switch (statusCode) {
    case 400:
    case 422:
      return new ValidationError(
        message,
        (body.errors as ValidationFieldError[]) ?? [],
        statusCode,
        requestId,
      );
    case 401:
      return new UnauthorizedError(message, requestId);
    case 403:
      return new ForbiddenError(message, requestId);
    case 404:
      return new NotFoundError(message, requestId);
    case 429: {
      const retryAfter = parseInt(headers?.['retry-after'] ?? '60', 10);
      return new RateLimitError(retryAfter, message, requestId);
    }
    default:
      return new NexConnectApiError(statusCode, 'API_ERROR', message, requestId);
  }
}

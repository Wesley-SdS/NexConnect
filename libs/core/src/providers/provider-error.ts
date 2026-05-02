import { ProviderType } from './provider-type.enum';

export class ProviderError extends Error {
  constructor(
    public readonly provider: ProviderType,
    public readonly code: string,
    message: string,
    public readonly retryable: boolean = false,
    public readonly httpStatus?: number,
    public readonly retryAfterMs?: number,
    public readonly raw?: unknown,
  ) {
    super(`[${provider}] ${code}: ${message}`);
    this.name = 'ProviderError';
  }
}

export class ProviderAuthenticationError extends ProviderError {
  constructor(provider: ProviderType, message: string, raw?: unknown) {
    super(provider, 'AUTHENTICATION_FAILED', message, false, 401, undefined, raw);
    this.name = 'ProviderAuthenticationError';
  }
}

export class ProviderRateLimitError extends ProviderError {
  constructor(provider: ProviderType, retryAfterMs: number, raw?: unknown) {
    super(
      provider,
      'RATE_LIMITED',
      `Provider rate limit exceeded (retry after ${retryAfterMs}ms)`,
      true,
      429,
      retryAfterMs,
      raw,
    );
    this.name = 'ProviderRateLimitError';
  }
}

export class ProviderValidationError extends ProviderError {
  constructor(provider: ProviderType, message: string, raw?: unknown) {
    super(provider, 'VALIDATION_FAILED', message, false, 400, undefined, raw);
    this.name = 'ProviderValidationError';
  }
}

export class ProviderNotConfiguredError extends ProviderError {
  constructor(provider: ProviderType) {
    super(provider, 'NOT_CONFIGURED', `Provider ${provider} is not configured`, false);
    this.name = 'ProviderNotConfiguredError';
  }
}

export class ProviderUnsupportedOperationError extends ProviderError {
  constructor(provider: ProviderType, operation: string) {
    super(
      provider,
      'UNSUPPORTED_OPERATION',
      `Operation ${operation} is not supported by ${provider}`,
      false,
    );
    this.name = 'ProviderUnsupportedOperationError';
  }
}

export class ProviderSignatureError extends ProviderError {
  constructor(provider: ProviderType, message = 'Invalid webhook signature') {
    super(provider, 'INVALID_SIGNATURE', message, false, 401);
    this.name = 'ProviderSignatureError';
  }
}

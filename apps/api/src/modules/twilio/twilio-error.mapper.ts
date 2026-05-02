import {
  ProviderAuthenticationError,
  ProviderError,
  ProviderRateLimitError,
  ProviderType,
  ProviderValidationError,
} from '@nexconnect/core';

interface TwilioSdkError {
  status?: number;
  code?: number;
  moreInfo?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export class TwilioErrorMapper {
  static from(provider: ProviderType, err: unknown): ProviderError {
    const e = err as TwilioSdkError;
    const status = e.status ?? 0;
    const code = e.code ?? 0;
    const message = e.message ?? 'Twilio error';

    if (status === 429 || code === 20429) {
      return new ProviderRateLimitError(provider, 30_000, err);
    }
    if (status === 401 || status === 403 || code === 20003 || code === 20005) {
      return new ProviderAuthenticationError(provider, message, err);
    }
    if (status === 400 || (code >= 21000 && code < 22000)) {
      return new ProviderValidationError(provider, message, err);
    }

    const retryable = status >= 500 && status < 600;
    return new ProviderError(
      provider,
      code ? `TWILIO_${code}` : `HTTP_${status}`,
      message,
      retryable,
      status,
      undefined,
      err,
    );
  }
}

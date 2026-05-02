import {
  ProviderAuthenticationError,
  ProviderError,
  ProviderRateLimitError,
  ProviderType,
  ProviderValidationError,
} from '@nexconnect/core';
import { GraphErrorResponse } from '../types/graph-api.types';

const MESSAGE_UNDELIVERABLE_CODES = new Set([131026, 131031, 131047, 131048, 131052, 131053]);
const RATE_LIMIT_CODES = new Set([4, 80007, 130429, 131056]);
const AUTH_CODES = new Set([190, 102, 10]);

export class MetaErrorMapper {
  static from(
    provider: ProviderType,
    status: number,
    payload: unknown,
    fallbackMessage = 'Meta Graph API error',
  ): ProviderError {
    const parsed = this.parse(payload);
    const code = parsed?.error.code;
    const message = parsed?.error.message ?? fallbackMessage;

    if (status === 429 || (code && RATE_LIMIT_CODES.has(code))) {
      return new ProviderRateLimitError(provider, 60_000, payload);
    }

    if (status === 401 || status === 403 || (code && AUTH_CODES.has(code))) {
      return new ProviderAuthenticationError(provider, message, payload);
    }

    if (status === 400 || (code && code >= 100 && code < 200) || (code && MESSAGE_UNDELIVERABLE_CODES.has(code))) {
      return new ProviderValidationError(provider, message, payload);
    }

    const retryable = status >= 500 && status < 600;
    return new ProviderError(
      provider,
      code ? `GRAPH_${code}` : `HTTP_${status}`,
      message,
      retryable,
      status,
      undefined,
      payload,
    );
  }

  private static parse(payload: unknown): GraphErrorResponse | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    if ('error' in payload && typeof (payload as GraphErrorResponse).error === 'object') {
      return payload as GraphErrorResponse;
    }
    return null;
  }
}

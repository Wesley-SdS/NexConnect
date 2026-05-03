import {
  ProviderAuthenticationError,
  ProviderError,
  ProviderRateLimitError,
  ProviderType,
  ProviderValidationError,
} from '@nexconnect/core';
import { TelegramApiResponse } from './types/telegram.types';

/**
 * Maps Telegram Bot API error responses to NexConnect's normalized
 * ProviderError hierarchy. Telegram returns errors as { ok: false,
 * error_code, description, parameters?: { retry_after? } }.
 */
export class TelegramErrorMapper {
  static from(httpStatus: number, payload: unknown): ProviderError {
    const response = payload as Partial<TelegramApiResponse<unknown>>;
    const code = response?.error_code ?? httpStatus;
    const description = response?.description ?? 'Telegram Bot API error';
    const retryAfter = response?.parameters?.retry_after;

    if (httpStatus === 429 || code === 429) {
      return new ProviderRateLimitError(
        ProviderType.TELEGRAM,
        (retryAfter ?? 30) * 1000,
        payload,
      );
    }

    if (httpStatus === 401 || code === 401) {
      return new ProviderAuthenticationError(ProviderType.TELEGRAM, description, payload);
    }

    if (httpStatus === 400 || code === 400) {
      return new ProviderValidationError(ProviderType.TELEGRAM, description, payload);
    }

    const retryable = httpStatus >= 500 && httpStatus < 600;
    return new ProviderError(
      ProviderType.TELEGRAM,
      `TELEGRAM_${code}`,
      description,
      retryable,
      httpStatus,
      retryAfter ? retryAfter * 1000 : undefined,
      payload,
    );
  }
}

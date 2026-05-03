import {
  ProviderAuthenticationError,
  ProviderError,
  ProviderRateLimitError,
  ProviderType,
  ProviderValidationError,
} from '@nexconnect/core';

interface DiscordErrorBody {
  code?: number;
  message?: string;
  retry_after?: number;
  errors?: Record<string, unknown>;
}

/**
 * Maps Discord REST API errors to ProviderError. Discord uses HTTP
 * status codes plus an internal `code` field documented at
 * https://discord.com/developers/docs/topics/opcodes-and-status-codes
 */
export class DiscordErrorMapper {
  static from(httpStatus: number, payload: unknown): ProviderError {
    const body = payload as Partial<DiscordErrorBody> | undefined;
    const code = body?.code ?? httpStatus;
    const message = body?.message ?? 'Discord API error';

    if (httpStatus === 429) {
      const retryMs = (body?.retry_after ?? 30) * 1000;
      return new ProviderRateLimitError(ProviderType.DISCORD, retryMs, payload);
    }
    if (httpStatus === 401 || httpStatus === 403) {
      return new ProviderAuthenticationError(ProviderType.DISCORD, message, payload);
    }
    if (httpStatus === 400 || httpStatus === 404) {
      return new ProviderValidationError(ProviderType.DISCORD, message, payload);
    }
    return new ProviderError(
      ProviderType.DISCORD,
      `DISCORD_${code}`,
      message,
      httpStatus >= 500 && httpStatus < 600,
      httpStatus,
      undefined,
      payload,
    );
  }
}

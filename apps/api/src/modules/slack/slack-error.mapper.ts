import {
  ProviderAuthenticationError,
  ProviderError,
  ProviderRateLimitError,
  ProviderType,
  ProviderValidationError,
} from '@nexconnect/core';

const AUTH_ERRORS = new Set([
  'invalid_auth',
  'token_revoked',
  'token_expired',
  'account_inactive',
  'not_authed',
]);

const RATE_LIMIT_ERRORS = new Set(['rate_limited', 'ratelimited']);

const VALIDATION_ERRORS = new Set([
  'invalid_arguments',
  'channel_not_found',
  'not_in_channel',
  'is_archived',
  'msg_too_long',
  'no_text',
  'restricted_action',
  'too_many_attachments',
]);

/**
 * Maps Slack Web API error responses (`{ ok: false, error: '...' }`) to
 * the normalized ProviderError hierarchy.
 */
export class SlackErrorMapper {
  static fromSlackResponse(payload: { ok: boolean; error?: string; response_metadata?: { warnings?: string[] } }): ProviderError {
    const code = payload.error ?? 'unknown_error';

    if (AUTH_ERRORS.has(code)) {
      return new ProviderAuthenticationError(ProviderType.SLACK, code, payload);
    }
    if (RATE_LIMIT_ERRORS.has(code)) {
      return new ProviderRateLimitError(ProviderType.SLACK, 30_000, payload);
    }
    if (VALIDATION_ERRORS.has(code)) {
      return new ProviderValidationError(ProviderType.SLACK, code, payload);
    }
    return new ProviderError(
      ProviderType.SLACK,
      `SLACK_${code.toUpperCase()}`,
      code,
      false,
      undefined,
      undefined,
      payload,
    );
  }

  static fromHttpStatus(status: number, body: unknown): ProviderError {
    if (status === 429) {
      return new ProviderRateLimitError(ProviderType.SLACK, 30_000, body);
    }
    if (status === 401 || status === 403) {
      return new ProviderAuthenticationError(ProviderType.SLACK, `HTTP ${status}`, body);
    }
    return new ProviderError(
      ProviderType.SLACK,
      `HTTP_${status}`,
      `Slack HTTP error ${status}`,
      status >= 500,
      status,
      undefined,
      body,
    );
  }
}

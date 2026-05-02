import { createHmac, timingSafeEqual } from 'crypto';

export interface SlackSignatureValidationInput {
  /** X-Slack-Signature header (e.g., "v0=hex..."). */
  signatureHeader: string | undefined | null;
  /** X-Slack-Request-Timestamp header (unix seconds, ASCII). */
  timestampHeader: string | undefined | null;
  /** App's signing secret (Slack admin → Basic Information). */
  signingSecret: string;
  /** Raw request body bytes. */
  rawBody: Buffer | string;
  /** Maximum acceptable clock skew in seconds (default: 300 = 5 min). */
  toleranceSeconds?: number;
}

export interface SlackSignatureResult {
  valid: boolean;
  reason?:
    | 'MISSING_HEADER'
    | 'MALFORMED_HEADER'
    | 'TIMESTAMP_OUT_OF_RANGE'
    | 'LENGTH_MISMATCH'
    | 'HASH_MISMATCH';
}

const SLACK_VERSION = 'v0';

/**
 * Validates the X-Slack-Signature header per Slack's signing protocol.
 * The signature base string is `v0:<timestamp>:<raw_body>`, signed with
 * HMAC-SHA256 using the app's signing secret. Slack also requires
 * rejecting timestamps outside ±5 minutes to mitigate replay attacks.
 */
export class SlackSignatureValidator {
  static validate(input: SlackSignatureValidationInput): SlackSignatureResult {
    if (!input.signatureHeader || !input.timestampHeader) {
      return { valid: false, reason: 'MISSING_HEADER' };
    }

    if (!input.signatureHeader.startsWith(`${SLACK_VERSION}=`)) {
      return { valid: false, reason: 'MALFORMED_HEADER' };
    }

    const timestamp = Number(input.timestampHeader);
    if (!Number.isFinite(timestamp)) {
      return { valid: false, reason: 'MALFORMED_HEADER' };
    }

    const tolerance = input.toleranceSeconds ?? 300;
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestamp) > tolerance) {
      return { valid: false, reason: 'TIMESTAMP_OUT_OF_RANGE' };
    }

    const providedHex = input.signatureHeader.slice(SLACK_VERSION.length + 1);
    if (!/^[a-f0-9]{64}$/i.test(providedHex)) {
      return { valid: false, reason: 'MALFORMED_HEADER' };
    }

    const body = typeof input.rawBody === 'string' ? input.rawBody : input.rawBody.toString('utf8');
    const baseString = `${SLACK_VERSION}:${input.timestampHeader}:${body}`;
    const expectedHex = createHmac('sha256', input.signingSecret)
      .update(baseString)
      .digest('hex');

    const providedBuffer = Buffer.from(providedHex, 'hex');
    const expectedBuffer = Buffer.from(expectedHex, 'hex');

    if (providedBuffer.length !== expectedBuffer.length) {
      return { valid: false, reason: 'LENGTH_MISMATCH' };
    }

    return timingSafeEqual(providedBuffer, expectedBuffer)
      ? { valid: true }
      : { valid: false, reason: 'HASH_MISMATCH' };
  }

  static sign(
    timestamp: string,
    rawBody: Buffer | string,
    signingSecret: string,
  ): string {
    const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const baseString = `${SLACK_VERSION}:${timestamp}:${body}`;
    const hex = createHmac('sha256', signingSecret).update(baseString).digest('hex');
    return `${SLACK_VERSION}=${hex}`;
  }
}

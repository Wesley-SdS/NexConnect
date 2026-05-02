import { createHmac, timingSafeEqual } from 'crypto';

export interface MetaSignatureValidationInput {
  rawBody: Buffer | string;
  signatureHeader: string | undefined | null;
  appSecret: string;
}

export interface MetaSignatureResult {
  valid: boolean;
  reason?: 'MISSING_HEADER' | 'MALFORMED_HEADER' | 'LENGTH_MISMATCH' | 'HASH_MISMATCH';
}

const HEADER_PREFIX = 'sha256=';

export class MetaSignatureValidator {
  static validate(input: MetaSignatureValidationInput): MetaSignatureResult {
    if (!input.signatureHeader) {
      return { valid: false, reason: 'MISSING_HEADER' };
    }

    if (!input.signatureHeader.startsWith(HEADER_PREFIX)) {
      return { valid: false, reason: 'MALFORMED_HEADER' };
    }

    const providedHex = input.signatureHeader.slice(HEADER_PREFIX.length);
    if (!/^[a-f0-9]{64}$/i.test(providedHex)) {
      return { valid: false, reason: 'MALFORMED_HEADER' };
    }

    const payload =
      typeof input.rawBody === 'string' ? Buffer.from(input.rawBody, 'utf8') : input.rawBody;

    const expectedHex = createHmac('sha256', input.appSecret).update(payload).digest('hex');

    const providedBuffer = Buffer.from(providedHex, 'hex');
    const expectedBuffer = Buffer.from(expectedHex, 'hex');

    if (providedBuffer.length !== expectedBuffer.length) {
      return { valid: false, reason: 'LENGTH_MISMATCH' };
    }

    return timingSafeEqual(providedBuffer, expectedBuffer)
      ? { valid: true }
      : { valid: false, reason: 'HASH_MISMATCH' };
  }

  static sign(rawBody: Buffer | string, appSecret: string): string {
    const payload = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
    return `${HEADER_PREFIX}${createHmac('sha256', appSecret).update(payload).digest('hex')}`;
  }
}

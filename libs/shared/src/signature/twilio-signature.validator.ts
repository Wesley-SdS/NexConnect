import { createHash, createHmac, timingSafeEqual } from 'crypto';

export interface TwilioFormValidationInput {
  authToken: string;
  signatureHeader: string | undefined | null;
  url: string;
  params: Record<string, string>;
}

export interface TwilioJsonValidationInput {
  authToken: string;
  signatureHeader: string | undefined | null;
  url: string;
  rawBody: Buffer | string;
  bodyHashQueryParam?: string;
}

export interface TwilioSignatureResult {
  valid: boolean;
  reason?:
    | 'MISSING_HEADER'
    | 'HASH_MISMATCH'
    | 'LENGTH_MISMATCH'
    | 'BODY_HASH_MISMATCH'
    | 'MALFORMED_URL';
}

export class TwilioSignatureValidator {
  static validateForm(input: TwilioFormValidationInput): TwilioSignatureResult {
    if (!input.signatureHeader) {
      return { valid: false, reason: 'MISSING_HEADER' };
    }

    const sortedKeys = Object.keys(input.params).sort();
    let concatenated = input.url;
    for (const key of sortedKeys) {
      concatenated += key + input.params[key];
    }

    return this.compare(concatenated, input.signatureHeader, input.authToken);
  }

  static validateJson(input: TwilioJsonValidationInput): TwilioSignatureResult {
    if (!input.signatureHeader) {
      return { valid: false, reason: 'MISSING_HEADER' };
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(input.url);
    } catch {
      return { valid: false, reason: 'MALFORMED_URL' };
    }

    const bodyHashParam = input.bodyHashQueryParam ?? 'bodySHA256';
    const expectedBodyHash = parsedUrl.searchParams.get(bodyHashParam);

    if (!expectedBodyHash) {
      return { valid: false, reason: 'BODY_HASH_MISMATCH' };
    }

    const payload =
      typeof input.rawBody === 'string' ? Buffer.from(input.rawBody, 'utf8') : input.rawBody;
    const actualBodyHash = createHash('sha256').update(payload).digest('hex');

    if (actualBodyHash !== expectedBodyHash) {
      return { valid: false, reason: 'BODY_HASH_MISMATCH' };
    }

    return this.compare(input.url, input.signatureHeader, input.authToken);
  }

  static signForm(url: string, params: Record<string, string>, authToken: string): string {
    const sortedKeys = Object.keys(params).sort();
    let concatenated = url;
    for (const key of sortedKeys) {
      concatenated += key + params[key];
    }
    return createHmac('sha1', authToken).update(concatenated).digest('base64');
  }

  private static compare(
    concatenated: string,
    providedSignature: string,
    authToken: string,
  ): TwilioSignatureResult {
    const expected = createHmac('sha1', authToken).update(concatenated).digest('base64');
    const providedBuffer = Buffer.from(providedSignature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    if (providedBuffer.length !== expectedBuffer.length) {
      return { valid: false, reason: 'LENGTH_MISMATCH' };
    }
    return timingSafeEqual(providedBuffer, expectedBuffer)
      ? { valid: true }
      : { valid: false, reason: 'HASH_MISMATCH' };
  }
}

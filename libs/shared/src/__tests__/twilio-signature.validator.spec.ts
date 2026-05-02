import { createHash, createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import { TwilioSignatureValidator } from '../signature/twilio-signature.validator';

describe('TwilioSignatureValidator - form', () => {
  const authToken = 'super-secret-token';
  const url = 'https://example.com/webhook';
  const params = {
    To: '+5511999999999',
    From: '+5511888888888',
    Body: 'hello world',
    MessageSid: 'SMabc',
  };

  const concat = () => {
    const sorted = Object.keys(params).sort();
    let s = url;
    for (const key of sorted) s += key + (params as Record<string, string>)[key];
    return s;
  };

  const signature = () => createHmac('sha1', authToken).update(concat()).digest('base64');

  it('accepts a correctly signed form payload', () => {
    const result = TwilioSignatureValidator.validateForm({
      authToken,
      signatureHeader: signature(),
      url,
      params,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects a tampered parameter', () => {
    const result = TwilioSignatureValidator.validateForm({
      authToken,
      signatureHeader: signature(),
      url,
      params: { ...params, Body: 'tampered' },
    });
    expect(result.valid).toBe(false);
  });

  it('rejects missing header', () => {
    const result = TwilioSignatureValidator.validateForm({
      authToken,
      signatureHeader: undefined,
      url,
      params,
    });
    expect(result).toEqual({ valid: false, reason: 'MISSING_HEADER' });
  });

  it('signForm matches reference HMAC-SHA1', () => {
    expect(TwilioSignatureValidator.signForm(url, params, authToken)).toBe(signature());
  });
});

describe('TwilioSignatureValidator - JSON', () => {
  const authToken = 'json-secret';
  const rawBody = JSON.stringify({ hello: 'world', foo: 'bar' });
  const bodyHash = createHash('sha256').update(rawBody).digest('hex');
  const url = `https://example.com/webhook?bodySHA256=${bodyHash}`;
  const signed = createHmac('sha1', authToken).update(url).digest('base64');

  it('accepts a valid JSON payload with matching body hash', () => {
    const result = TwilioSignatureValidator.validateJson({
      authToken,
      signatureHeader: signed,
      url,
      rawBody,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects when body hash differs', () => {
    const result = TwilioSignatureValidator.validateJson({
      authToken,
      signatureHeader: signed,
      url,
      rawBody: rawBody + 'x',
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('BODY_HASH_MISMATCH');
  });

  it('rejects when URL is missing bodySHA256', () => {
    const result = TwilioSignatureValidator.validateJson({
      authToken,
      signatureHeader: signed,
      url: 'https://example.com/webhook',
      rawBody,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('BODY_HASH_MISMATCH');
  });
});

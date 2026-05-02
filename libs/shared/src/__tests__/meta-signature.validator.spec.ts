import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import { MetaSignatureValidator } from '../signature/meta-signature.validator';

describe('MetaSignatureValidator', () => {
  const appSecret = 'unit-test-secret-0123456789';
  const payload = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account', entry: [] }), 'utf8');
  const validSignature =
    'sha256=' + createHmac('sha256', appSecret).update(payload).digest('hex');

  it('accepts a correct sha256 signature', () => {
    const result = MetaSignatureValidator.validate({
      rawBody: payload,
      signatureHeader: validSignature,
      appSecret,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects missing header', () => {
    const result = MetaSignatureValidator.validate({
      rawBody: payload,
      signatureHeader: undefined,
      appSecret,
    });
    expect(result).toEqual({ valid: false, reason: 'MISSING_HEADER' });
  });

  it('rejects header without sha256= prefix', () => {
    const result = MetaSignatureValidator.validate({
      rawBody: payload,
      signatureHeader: 'abcdef0123',
      appSecret,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('MALFORMED_HEADER');
  });

  it('rejects non-hex signature', () => {
    const result = MetaSignatureValidator.validate({
      rawBody: payload,
      signatureHeader: 'sha256=notvalidhex',
      appSecret,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('MALFORMED_HEADER');
  });

  it('rejects wrong secret', () => {
    const result = MetaSignatureValidator.validate({
      rawBody: payload,
      signatureHeader: validSignature,
      appSecret: 'wrong-secret',
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('HASH_MISMATCH');
  });

  it('rejects tampered body', () => {
    const result = MetaSignatureValidator.validate({
      rawBody: Buffer.from(payload.toString('utf8') + ' '),
      signatureHeader: validSignature,
      appSecret,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('HASH_MISMATCH');
  });

  it('signs payloads consistently with validation', () => {
    const header = MetaSignatureValidator.sign(payload, appSecret);
    expect(
      MetaSignatureValidator.validate({
        rawBody: payload,
        signatureHeader: header,
        appSecret,
      }).valid,
    ).toBe(true);
  });
});

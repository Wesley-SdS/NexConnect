import { describe, expect, it } from 'vitest';
import nacl from 'tweetnacl';
import { Ed25519SignatureValidator } from '../signature/ed25519-signature.validator';

describe('Ed25519SignatureValidator', () => {
  const keyPair = nacl.sign.keyPair();
  const publicKeyHex = Buffer.from(keyPair.publicKey).toString('hex');
  const timestamp = '1717000000';
  const body = JSON.stringify({ type: 1 });
  const signature = nacl.sign.detached(
    new Uint8Array(Buffer.concat([Buffer.from(timestamp), Buffer.from(body)])),
    keyPair.secretKey,
  );
  const signatureHex = Buffer.from(signature).toString('hex');

  it('accepts a valid signature', () => {
    const result = Ed25519SignatureValidator.validate({
      signatureHex,
      timestamp,
      publicKeyHex,
      rawBody: body,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects a missing signature header', () => {
    const result = Ed25519SignatureValidator.validate({
      signatureHex: undefined,
      timestamp,
      publicKeyHex,
      rawBody: body,
    });
    expect(result).toEqual({ valid: false, reason: 'MISSING_HEADER' });
  });

  it('rejects malformed signature length', () => {
    const result = Ed25519SignatureValidator.validate({
      signatureHex: 'abc',
      timestamp,
      publicKeyHex,
      rawBody: body,
    });
    expect(result.reason).toBe('MALFORMED_SIGNATURE');
  });

  it('rejects tampered timestamp', () => {
    const result = Ed25519SignatureValidator.validate({
      signatureHex,
      timestamp: '9999999999',
      publicKeyHex,
      rawBody: body,
    });
    expect(result).toEqual({ valid: false, reason: 'SIGNATURE_MISMATCH' });
  });

  it('rejects tampered body', () => {
    const result = Ed25519SignatureValidator.validate({
      signatureHex,
      timestamp,
      publicKeyHex,
      rawBody: body + 'x',
    });
    expect(result).toEqual({ valid: false, reason: 'SIGNATURE_MISMATCH' });
  });
});

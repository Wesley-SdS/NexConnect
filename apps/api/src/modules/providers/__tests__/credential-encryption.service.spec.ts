import { beforeEach, describe, expect, it } from 'vitest';
import { ProviderType } from '@nexconnect/core';
import { CredentialEncryptionService } from '../credential-encryption.service';

describe('CredentialEncryptionService', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'test-key-32-bytes-for-aes-gcm!!';
  });

  it('roundtrips a Meta WhatsApp credential payload', () => {
    const svc = new CredentialEncryptionService();
    const payload = {
      type: ProviderType.META_WHATSAPP_CLOUD as const,
      businessAccountId: 'ba-123',
      phoneNumberId: 'pn-456',
      accessToken: 'EAAxxxx.tokenvalue',
      appSecret: 'app-secret',
      webhookVerifyToken: 'verify-token',
    };
    const encrypted = svc.encrypt(payload);
    const decrypted = svc.decrypt(encrypted);
    expect(decrypted).toEqual(payload);
  });

  it('roundtrips a Twilio credential payload', () => {
    const svc = new CredentialEncryptionService();
    const payload = {
      type: ProviderType.TWILIO_SMS as const,
      accountSid: 'AC123',
      authToken: 'auth-token-value',
      fromNumber: '+15550001111',
    };
    const encrypted = svc.encrypt(payload);
    const decrypted = svc.decrypt(encrypted);
    expect(decrypted).toEqual(payload);
  });

  it('produces distinct ciphertext on each encrypt (random IV)', () => {
    const svc = new CredentialEncryptionService();
    const payload = {
      type: ProviderType.META_WHATSAPP_CLOUD as const,
      businessAccountId: 'ba',
      phoneNumberId: 'pn',
      accessToken: 't',
      appSecret: 's',
      webhookVerifyToken: 'vt',
    };
    const a = svc.encrypt(payload);
    const b = svc.encrypt(payload);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('throws when ENCRYPTION_KEY is too short', () => {
    process.env.ENCRYPTION_KEY = 'short';
    expect(() => new CredentialEncryptionService()).toThrow(/at least 16 chars/);
  });

  it('fails to decrypt with a different key (GCM auth tag check)', () => {
    process.env.ENCRYPTION_KEY = 'key-number-one-must-be-32-bytes!';
    const svc1 = new CredentialEncryptionService();
    const encrypted = svc1.encrypt({
      type: ProviderType.TWILIO_SMS,
      accountSid: 'AC',
      authToken: 't',
    });

    process.env.ENCRYPTION_KEY = 'key-number-two-must-be-32-bytes!';
    const svc2 = new CredentialEncryptionService();
    expect(() => svc2.decrypt(encrypted)).toThrow();
  });
});

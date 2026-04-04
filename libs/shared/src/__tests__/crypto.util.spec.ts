import { describe, it, expect } from 'vitest';
import { CryptoUtil } from '../utils/crypto.util';

describe('CryptoUtil', () => {
  describe('generateApiKey', () => {
    it('should generate key with nc_ prefix', () => {
      const result = CryptoUtil.generateApiKey();

      expect(result.prefix).toMatch(/^nc_/);
      expect(result.raw).toBeDefined();
      expect(result.hash).toBeDefined();
      expect(result.raw.length).toBeGreaterThan(20);
    });

    it('should generate unique keys', () => {
      const key1 = CryptoUtil.generateApiKey();
      const key2 = CryptoUtil.generateApiKey();

      expect(key1.raw).not.toBe(key2.raw);
    });
  });

  describe('HMAC signature', () => {
    it('should generate valid HMAC-SHA256', () => {
      const payload = '{"test": true}';
      const secret = 'my-webhook-secret';

      const signature = CryptoUtil.generateHmacSignature(payload, secret);

      expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should verify correct signature', () => {
      const payload = '{"test": true}';
      const secret = 'my-webhook-secret';

      const signature = CryptoUtil.generateHmacSignature(payload, secret);
      const isValid = CryptoUtil.verifyHmacSignature(payload, secret, signature);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect signature', () => {
      const payload = '{"test": true}';
      const secret = 'my-webhook-secret';

      const isValid = CryptoUtil.verifyHmacSignature(payload, secret, 'invalid');

      expect(isValid).toBe(false);
    });

    it('should produce different signatures for different payloads', () => {
      const secret = 'same-secret';

      const sig1 = CryptoUtil.generateHmacSignature('payload1', secret);
      const sig2 = CryptoUtil.generateHmacSignature('payload2', secret);

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt data correctly', () => {
      const key = 'a'.repeat(32); // 32 bytes for AES-256
      const plaintext = 'sensitive auth state data';

      const encrypted = CryptoUtil.encrypt(plaintext, key);
      const decrypted = CryptoUtil.decrypt(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const key = 'b'.repeat(32);
      const plaintext = 'same data';

      const encrypted1 = CryptoUtil.encrypt(plaintext, key);
      const encrypted2 = CryptoUtil.encrypt(plaintext, key);

      // AES-GCM uses random IV, so ciphertexts should differ
      expect(encrypted1.toString('hex')).not.toBe(encrypted2.toString('hex'));
    });

    it('should fail to decrypt with wrong key', () => {
      const key1 = 'a'.repeat(32);
      const key2 = 'b'.repeat(32);
      const plaintext = 'sensitive data';

      const encrypted = CryptoUtil.encrypt(plaintext, key1);

      expect(() => CryptoUtil.decrypt(encrypted, key2)).toThrow();
    });
  });
});

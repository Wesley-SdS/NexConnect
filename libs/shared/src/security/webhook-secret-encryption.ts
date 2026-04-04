import { CryptoUtil } from '../utils/crypto.util';

/**
 * Encrypts a webhook secret using AES-256-GCM via CryptoUtil.
 * Returns a base64-encoded string suitable for database storage.
 */
export function encryptWebhookSecret(
  secret: string,
  encryptionKey: string,
): string {
  const secretBuffer = Buffer.from(secret, 'utf-8');
  const encrypted = CryptoUtil.encrypt(secretBuffer, encryptionKey);
  return encrypted.toString('base64');
}

/**
 * Decrypts a base64-encoded webhook secret that was encrypted with `encryptWebhookSecret`.
 * Returns the original plaintext secret.
 */
export function decryptWebhookSecret(
  encrypted: string,
  encryptionKey: string,
): string {
  const encryptedBuffer = Buffer.from(encrypted, 'base64');
  const decrypted = CryptoUtil.decrypt(encryptedBuffer, encryptionKey);
  return decrypted.toString('utf-8');
}

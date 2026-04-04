import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
import * as bcrypt from 'bcrypt';
import { API_KEY_HASH_ROUNDS, API_KEY_LENGTH, API_KEY_PREFIX } from '../constants';

const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export class CryptoUtil {
  static generateApiKey(): { raw: string; hash: string; prefix: string } {
    const rawBytes = randomBytes(API_KEY_LENGTH);
    const raw = `${API_KEY_PREFIX}${rawBytes.toString('base64url')}`;
    const hash = bcrypt.hashSync(raw, API_KEY_HASH_ROUNDS);
    const prefix = raw.substring(0, 8);

    return { raw, hash, prefix };
  }

  static hashApiKey(key: string): string {
    return bcrypt.hashSync(key, API_KEY_HASH_ROUNDS);
  }

  static verifyApiKey(key: string, hash: string): boolean {
    return bcrypt.compareSync(key, hash);
  }

  static generateHmacSignature(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  static verifyHmacSignature(
    payload: string,
    secret: string,
    signature: string,
  ): boolean {
    const expected = CryptoUtil.generateHmacSignature(payload, secret);

    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(sigBuffer, expectedBuffer);
  }

  static encrypt(data: Buffer, key: string): Buffer {
    const keyBuffer = CryptoUtil.deriveKeyBuffer(key);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(AES_ALGORITHM, keyBuffer, iv);

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, encrypted]);
  }

  static decrypt(encrypted: Buffer, key: string): Buffer {
    const keyBuffer = CryptoUtil.deriveKeyBuffer(key);
    const iv = encrypted.subarray(0, IV_LENGTH);
    const authTag = encrypted.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = encrypted.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(AES_ALGORITHM, keyBuffer, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  private static deriveKeyBuffer(key: string): Buffer {
    const keyBuffer = Buffer.from(key, 'utf-8');

    if (keyBuffer.length === 32) {
      return keyBuffer;
    }

    const padded = Buffer.alloc(32);
    keyBuffer.copy(padded, 0, 0, Math.min(keyBuffer.length, 32));
    return padded;
  }
}

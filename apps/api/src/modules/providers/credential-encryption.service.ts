import { Injectable } from '@nestjs/common';
import { ProviderCredentialData } from '@nexconnect/core';
import { CryptoUtil } from '@nexconnect/shared';

/**
 * Wraps AES-256-GCM encryption of JSON credential blobs with the
 * workspace-wide ENCRYPTION_KEY. Kept as a tiny class so it can be
 * mocked in tests and swapped for a KMS-backed implementation later
 * without touching callers.
 */
@Injectable()
export class CredentialEncryptionService {
  private readonly key: string;

  constructor() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length < 16) {
      throw new Error('ENCRYPTION_KEY must be configured and at least 16 chars long');
    }
    this.key = key;
  }

  encrypt(credentials: ProviderCredentialData): Uint8Array<ArrayBuffer> {
    const plaintext = Buffer.from(JSON.stringify(credentials), 'utf8');
    const encrypted = CryptoUtil.encrypt(plaintext, this.key);
    // Prisma requires Uint8Array<ArrayBuffer>. Copy into a fresh ArrayBuffer
    // to guarantee we never hand it a view backed by SharedArrayBuffer.
    const out = new Uint8Array(new ArrayBuffer(encrypted.byteLength));
    out.set(encrypted);
    return out;
  }

  decrypt(buffer: Uint8Array): ProviderCredentialData {
    const asBuffer = Buffer.from(buffer.buffer as ArrayBuffer, buffer.byteOffset, buffer.byteLength);
    const plaintext = CryptoUtil.decrypt(asBuffer, this.key);
    return JSON.parse(plaintext.toString('utf8')) as ProviderCredentialData;
  }
}

import nacl from 'tweetnacl';

export interface Ed25519ValidationInput {
  /** Hex-encoded Ed25519 signature from the X-Signature-Ed25519 header. */
  signatureHex: string | undefined | null;
  /** Timestamp from X-Signature-Timestamp header (ASCII string). */
  timestamp: string | undefined | null;
  /** Hex-encoded public key (Discord app's public key). */
  publicKeyHex: string;
  /** Raw request body bytes. */
  rawBody: Buffer | string;
}

export interface Ed25519Result {
  valid: boolean;
  reason?:
    | 'MISSING_HEADER'
    | 'MALFORMED_SIGNATURE'
    | 'MALFORMED_PUBLIC_KEY'
    | 'SIGNATURE_MISMATCH';
}

/**
 * Validates Ed25519 signatures sent by Discord on every interactions endpoint
 * delivery. Discord signs the concatenation of the timestamp and the raw
 * request body using the application's Ed25519 key pair.
 */
export class Ed25519SignatureValidator {
  static validate(input: Ed25519ValidationInput): Ed25519Result {
    if (!input.signatureHex || !input.timestamp) {
      return { valid: false, reason: 'MISSING_HEADER' };
    }
    if (!/^[a-f0-9]{128}$/i.test(input.signatureHex)) {
      return { valid: false, reason: 'MALFORMED_SIGNATURE' };
    }
    if (!/^[a-f0-9]{64}$/i.test(input.publicKeyHex)) {
      return { valid: false, reason: 'MALFORMED_PUBLIC_KEY' };
    }

    const body =
      typeof input.rawBody === 'string' ? Buffer.from(input.rawBody, 'utf8') : input.rawBody;
    const message = Buffer.concat([Buffer.from(input.timestamp, 'utf8'), body]);

    const signature = Buffer.from(input.signatureHex, 'hex');
    const publicKey = Buffer.from(input.publicKeyHex, 'hex');

    const ok = nacl.sign.detached.verify(
      new Uint8Array(message),
      new Uint8Array(signature),
      new Uint8Array(publicKey),
    );

    return ok ? { valid: true } : { valid: false, reason: 'SIGNATURE_MISMATCH' };
  }
}

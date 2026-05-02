import { Injectable } from '@nestjs/common';
import { TwilioCredentials } from '@nexconnect/core';
import twilio, { Twilio } from 'twilio';

/**
 * Thin factory that wraps the twilio SDK. Caches clients by SID so we
 * reuse the underlying HTTP keep-alive pool; per-tenant rotation of
 * auth tokens transparently invalidates the cache key.
 */
@Injectable()
export class TwilioClientFactory {
  private readonly cache = new Map<string, Twilio>();

  fromCredentials(creds: TwilioCredentials): Twilio {
    const cacheKey = this.cacheKey(creds);
    const hit = this.cache.get(cacheKey);
    if (hit) return hit;

    let client: Twilio;
    if (creds.apiKeySid && creds.apiKeySecret) {
      client = twilio(creds.apiKeySid, creds.apiKeySecret, {
        accountSid: creds.accountSid,
      });
    } else {
      client = twilio(creds.accountSid, creds.authToken);
    }
    this.cache.set(cacheKey, client);
    return client;
  }

  private cacheKey(creds: TwilioCredentials): string {
    if (creds.apiKeySid) {
      return `key:${creds.apiKeySid}`;
    }
    return `sid:${creds.accountSid}:${this.fingerprint(creds.authToken)}`;
  }

  private fingerprint(token: string): string {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash * 31 + token.charCodeAt(i)) | 0;
    }
    return String(hash);
  }
}

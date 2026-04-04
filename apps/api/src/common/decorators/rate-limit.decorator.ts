import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

export type RateLimitLevel = 'api-key' | 'instance' | 'recipient';

export interface RateLimitOptions {
  level: RateLimitLevel;
  limit?: number;
}

export const RateLimit = (level: RateLimitLevel, limit?: number) =>
  SetMetadata(RATE_LIMIT_KEY, { level, limit } as RateLimitOptions);

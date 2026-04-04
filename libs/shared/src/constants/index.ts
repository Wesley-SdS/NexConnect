// Instance limits
export const MAX_INSTANCES_PER_POD = 30;

// Buffer defaults
export const DEFAULT_BUFFER_WINDOW_MS = 3000;
export const DEFAULT_BUFFER_MAX_MESSAGES = 10;

// Webhook retry
export const DEFAULT_RETRY_ATTEMPTS = 5;
export const DEFAULT_RETRY_BACKOFF = 2.5;

// Deduplication
export const DEDUP_TTL_SECONDS = 3600;

// API Key
export const API_KEY_PREFIX = 'nc_';
export const API_KEY_HASH_ROUNDS = 12;
export const API_KEY_LENGTH = 48;

// Health score
export const HEALTH_SCORE_MAX = 100;
export const HEALTH_SCORE_MIN = 0;
export const HEALTH_SCORE_WARNING_THRESHOLD = 60;
export const HEALTH_SCORE_CRITICAL_THRESHOLD = 30;

// Rate limiting
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 60;
export const DEFAULT_RATE_LIMIT_PER_DAY = 5000;

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Timeouts
export const WEBHOOK_DELIVERY_TIMEOUT_MS = 10000;
export const INSTANCE_CONNECT_TIMEOUT_MS = 60000;
export const QR_CODE_EXPIRY_MS = 45000;

// Redis key prefixes
export const REDIS_PREFIX = {
  INSTANCE_STATUS: 'instance:status:',
  INSTANCE_LOCK: 'instance:lock:',
  BUFFER: 'buffer:',
  DEDUP: 'dedup:',
  RATE_LIMIT: 'ratelimit:',
  SESSION: 'session:',
} as const;

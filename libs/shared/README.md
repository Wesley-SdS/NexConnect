# @nexconnect/shared

Cross-cutting utilities, constants, exceptions, and observability modules used throughout the NexConnect monorepo.

## Utilities

### CryptoUtil

AES-256-GCM encryption/decryption for sensitive data (auth state, webhook secrets).

```ts
import { CryptoUtil } from '@nexconnect/shared';

const encrypted = CryptoUtil.encrypt(plaintext, encryptionKey);
const decrypted = CryptoUtil.decrypt(encrypted, encryptionKey);
```

### PhoneUtil

Phone number normalization and validation.

```ts
import { PhoneUtil } from '@nexconnect/shared';

const normalized = PhoneUtil.normalize('+55 (11) 99999-9999');
// => '5511999999999'

const isValid = PhoneUtil.isValid('5511999999999');
// => true
```

### UlidUtil

ULID generation for event and message IDs. Lexicographically sortable, collision-resistant.

```ts
import { UlidUtil } from '@nexconnect/shared';

const id = UlidUtil.generate();
// => '01HZXK4M3NQRST5V6W7X8Y9Z0A'
```

## Exceptions

### NexConnectException

Base exception class with structured error codes and HTTP status mapping.

```ts
import { NexConnectException } from '@nexconnect/shared';

throw new NexConnectException('INSTANCE_NOT_FOUND', 'Instance does not exist', 404);
```

## Observability

### PiiRedactor

Redacts personally identifiable information from log output. Masks phone numbers, API keys, and email addresses.

```ts
import { PiiRedactor } from '@nexconnect/shared';

const safe = PiiRedactor.redact('User +5511999999999 sent a message');
// => 'User +55119****9999 sent a message'
```

### TracingService / TracingModule

OpenTelemetry distributed tracing integration. Automatically instruments HTTP requests, database queries, and Redis commands.

```ts
import { TracingModule } from '@nexconnect/shared';

@Module({
  imports: [TracingModule],
})
export class AppModule {}
```

## Audit

### AuditService / AuditModule / @Audit()

Tenant-scoped audit logging. Records actions with actor, resource, IP, and metadata.

```ts
import { Audit } from '@nexconnect/shared';

@Audit('instance.create')
async createInstance(dto: CreateInstanceDto) { ... }
```

## Constants

Key constants exported from `@nexconnect/shared`:

| Constant | Value | Description |
|---|---|---|
| `MAX_INSTANCES_PER_POD` | 30 | Hard cap per worker pod |
| `DEFAULT_BUFFER_WINDOW_MS` | 3000 | Message buffer aggregation window |
| `DEFAULT_RETRY_ATTEMPTS` | 5 | Webhook delivery max retries |
| `DEFAULT_RETRY_BACKOFF` | 2.5 | Webhook retry exponential base |
| `DEDUP_TTL_SECONDS` | 3600 | Message deduplication TTL |
| `API_KEY_PREFIX` | `nc_` | API key prefix |
| `HEALTH_SCORE_CRITICAL_THRESHOLD` | 30 | Health score critical alert |
| `DEFAULT_RATE_LIMIT_PER_MINUTE` | 60 | API rate limit per tenant |
| `WEBHOOK_DELIVERY_TIMEOUT_MS` | 10000 | Webhook endpoint timeout |
| `QR_CODE_EXPIRY_MS` | 45000 | QR code validity window |

See `libs/shared/src/constants/index.ts` for the full list.

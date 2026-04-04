# @nexconnect/redis

Redis service wrapper for NexConnect. Provides a NestJS injectable service with two managed connections: one for general commands and one dedicated to pub/sub subscriptions.

## Usage

```ts
import { RedisModule } from '@nexconnect/redis';

@Module({
  imports: [RedisModule],
})
export class AppModule {}
```

```ts
import { RedisService } from '@nexconnect/redis';

@Injectable()
export class MyService {
  constructor(private readonly redis: RedisService) {}
}
```

## Methods

### Key-Value

| Method | Signature | Description |
|---|---|---|
| `get` | `get(key: string): Promise<string \| null>` | Get value by key |
| `set` | `set(key: string, value: string, ttlSeconds?: number): Promise<void>` | Set value with optional TTL |
| `del` | `del(...keys: string[]): Promise<number>` | Delete one or more keys |
| `exists` | `exists(...keys: string[]): Promise<number>` | Check key existence |
| `expire` | `expire(key: string, seconds: number): Promise<number>` | Set TTL on existing key |
| `incr` | `incr(key: string): Promise<number>` | Increment integer value |

### Hash

| Method | Signature | Description |
|---|---|---|
| `hset` | `hset(key: string, field: string, value: string): Promise<number>` | Set hash field |
| `hget` | `hget(key: string, field: string): Promise<string \| null>` | Get hash field |
| `hgetall` | `hgetall(key: string): Promise<Record<string, string>>` | Get all hash fields |

### Pub/Sub

| Method | Signature | Description |
|---|---|---|
| `publish` | `publish(channel: string, message: string): Promise<number>` | Publish message to channel |
| `subscribe` | `subscribe(channel: string, handler: (message, channel) => void): Promise<void>` | Subscribe to channel |

### Raw Client

| Method | Signature | Description |
|---|---|---|
| `getClient` | `getClient(): Redis` | Access the underlying ioredis client for advanced operations |

## Configuration

Environment variables:

| Variable | Default | Description |
|---|---|---|
| `REDIS_HOST` | `localhost` | Redis server hostname |
| `REDIS_PORT` | `6379` | Redis server port |
| `REDIS_PASSWORD` | — | Redis authentication password |

## Key Prefixes

Defined in `@nexconnect/shared` constants:

| Prefix | Usage |
|---|---|
| `instance:status:` | Cached instance connection status |
| `instance:lock:` | Distributed lock for instance operations |
| `buffer:` | Message buffer aggregation |
| `dedup:` | Message deduplication (TTL: 3600s) |
| `ratelimit:` | Rate limiting counters |
| `session:` | Session data cache |

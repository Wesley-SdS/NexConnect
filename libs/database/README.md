# @nexconnect/database

Prisma schema and database service for NexConnect. Wraps `PrismaClient` as a NestJS injectable service with lifecycle management.

## Schema

The Prisma schema is located at `prisma/schema.prisma` (monorepo root). It defines the following models:

| Model | Description |
|---|---|
| `Tenant` | Multi-tenant organization with plan and settings |
| `ApiKey` | Hashed API keys with scopes and expiration |
| `Instance` | WhatsApp connection instance with encrypted auth state |
| `Webhook` | Webhook endpoint configuration per instance |
| `Message` | Inbound/outbound message log with status tracking |
| `Event` | System events (ULID-based IDs, sortable) |
| `WebhookDelivery` | Delivery attempt log with response codes |
| `MediaAsset` | Media files stored in R2 with optional transcription |
| `NumberHealth` | Per-instance health metrics (response rate, bounce rate) |
| `ScheduledMessage` | One-time or cron-based scheduled messages |
| `AuditLog` | Tenant-scoped audit trail |
| `CronJob` | Recurring message jobs with timezone support |
| `Broadcast` | Bulk message campaigns with round-robin strategy |
| `Blacklist` / `Whitelist` | Per-instance phone number filtering |
| `SandboxSession` | Temporary sandbox environment for testing |

## PrismaService

NestJS injectable that extends `PrismaClient`:
```ts
import { PrismaService } from '@nexconnect/database';

@Injectable()
export class MyService {
  constructor(private readonly prisma: PrismaService) {}

  async findInstance(id: string) {
    return this.prisma.instance.findUnique({ where: { id } });
  }
}
```

## Commands

Run from the monorepo root:

```bash
# Generate Prisma Client after schema changes
pnpm db:generate

# Create and apply a new migration
pnpm db:migrate

# Push schema changes without creating a migration (dev only)
pnpm db:push

# Seed the database
pnpm db:seed

# Open Prisma Studio (visual database browser)
pnpm db:studio
```

## Configuration

Set `DATABASE_URL` in your `.env` file:
```
DATABASE_URL="postgresql://nexconnect:nexconnect@localhost:5432/nexconnect"
```

PostgreSQL 16+ is required. The schema uses the `pgcrypto` extension for `gen_random_uuid()`.

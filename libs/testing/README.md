# @nexconnect/testing

Shared testing utilities for NexConnect integration and E2E tests.

## Features

- **Testcontainers** — spins up real PostgreSQL 16 and Redis 7 containers for integration tests
- **Prisma helpers** — creates isolated `PrismaClient` instances and truncates tables between tests

## Usage

```typescript
import { setupTestContainers, createTestPrismaClient, cleanDatabase } from '@nexconnect/testing';

let containers: TestContainers;
let prisma: PrismaClient;

beforeAll(async () => {
  containers = await setupTestContainers();
  prisma = await createTestPrismaClient();
}, 120_000);

afterAll(async () => {
  await prisma.$disconnect();
  await containers.cleanup();
});

beforeEach(async () => {
  await cleanDatabase(prisma);
});
```

## Requirements

- Docker running locally (Testcontainers manages container lifecycle)
- Prisma schema at `prisma/schema.prisma` (used by `db push`)

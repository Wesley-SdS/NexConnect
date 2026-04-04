import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { execSync } from 'child_process';

export interface TestContainers {
  postgres: StartedPostgreSqlContainer;
  redis: StartedTestContainer;
  cleanup: () => Promise<void>;
}

export async function setupTestContainers(): Promise<TestContainers> {
  const postgres = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('nexconnect_test')
    .withUsername('nexconnect')
    .withPassword('nexconnect')
    .start();

  const redis = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .start();

  process.env.DATABASE_URL = postgres.getConnectionUri();
  process.env.REDIS_HOST = redis.getHost();
  process.env.REDIS_PORT = String(redis.getMappedPort(6379));

  execSync('npx prisma db push --skip-generate', {
    env: { ...process.env, DATABASE_URL: postgres.getConnectionUri() },
    cwd: process.cwd(),
    stdio: 'pipe',
  });

  const cleanup = async () => {
    await postgres.stop();
    await redis.stop();
  };

  return { postgres, redis, cleanup };
}

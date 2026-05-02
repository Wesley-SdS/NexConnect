import { Injectable } from '@nestjs/common';
import { PrismaService } from '@nexconnect/database';
import { RedisService } from '@nexconnect/redis';

export interface ProviderHealthCounts {
  total: number;
  active: number;
  revoked: number;
  expired: number;
  error: number;
}

export interface HealthCheckResult {
  status: string;
  checks: Record<string, string>;
  providers?: Record<string, ProviderHealthCounts>;
}

@Injectable()
export class HealthCheckService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async checkDatabase(): Promise<string> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'healthy';
    } catch {
      return 'unhealthy';
    }
  }

  async checkRedis(): Promise<string> {
    try {
      await this.redis.ping();
      return 'healthy';
    } catch {
      return 'unhealthy';
    }
  }

  async checkProviders(): Promise<{
    status: string;
    perProvider: Record<string, ProviderHealthCounts>;
  }> {
    try {
      const rows = await this.prisma.providerCredential.groupBy({
        by: ['provider', 'status'],
        _count: { _all: true },
      });
      const perProvider: Record<string, ProviderHealthCounts> = {};
      for (const row of rows) {
        const key = row.provider as unknown as string;
        const bucket = perProvider[key] ?? {
          total: 0,
          active: 0,
          revoked: 0,
          expired: 0,
          error: 0,
        };
        bucket.total += row._count._all;
        switch (row.status) {
          case 'ACTIVE':
            bucket.active += row._count._all;
            break;
          case 'REVOKED':
            bucket.revoked += row._count._all;
            break;
          case 'EXPIRED':
            bucket.expired += row._count._all;
            break;
          case 'ERROR':
            bucket.error += row._count._all;
            break;
        }
        perProvider[key] = bucket;
      }
      const hasErroredCredentials = Object.values(perProvider).some((b) => b.error > 0);
      return {
        status: hasErroredCredentials ? 'degraded' : 'healthy',
        perProvider,
      };
    } catch {
      return { status: 'unhealthy', perProvider: {} };
    }
  }

  async checkAll(): Promise<HealthCheckResult> {
    const [database, redis, providers] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkProviders(),
    ]);

    const checks = { database, redis, providers: providers.status };
    const allHealthy = Object.values(checks).every((v) => v === 'healthy');

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      providers: providers.perProvider,
    };
  }

  async isReady(): Promise<boolean> {
    const [dbResult, redisResult] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.ping(),
    ]);

    return (
      dbResult.status === 'fulfilled' && redisResult.status === 'fulfilled'
    );
  }
}

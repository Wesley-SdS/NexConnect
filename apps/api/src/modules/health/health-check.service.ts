import { Injectable } from '@nestjs/common';
import { PrismaService } from '@nexconnect/database';
import { RedisService } from '@nexconnect/redis';

export interface HealthCheckResult {
  status: string;
  checks: Record<string, string>;
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

  async checkAll(): Promise<HealthCheckResult> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const checks = { database, redis };
    const allHealthy = Object.values(checks).every((v) => v === 'healthy');

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
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

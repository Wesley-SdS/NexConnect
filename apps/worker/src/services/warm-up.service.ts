import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@nexconnect/database';
import { RedisService } from '@nexconnect/redis';

interface WarmUpPhase {
  maxDays: number;
  dailyLimit: number;
  minDelayMs: number;
  maxDelayMs: number;
}

const WARM_UP_PHASES: WarmUpPhase[] = [
  { maxDays: 3, dailyLimit: 10, minDelayMs: 15_000, maxDelayMs: 30_000 },
  { maxDays: 7, dailyLimit: 50, minDelayMs: 5_000, maxDelayMs: 15_000 },
  { maxDays: 14, dailyLimit: 200, minDelayMs: 2_000, maxDelayMs: 8_000 },
  { maxDays: 30, dailyLimit: 1_000, minDelayMs: 1_000, maxDelayMs: 3_000 },
];

@Injectable()
export class WarmUpService {
  private readonly logger = new Logger(WarmUpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getDailyLimit(instanceId: string): Promise<number> {
    const ageDays = await this.getInstanceAgeDays(instanceId);
    const phase = this.resolvePhase(ageDays);

    if (!phase) {
      const instance = await this.prisma.instance.findUnique({
        where: { id: instanceId },
        select: { settings: true },
      });

      const settings = instance?.settings as Record<string, any> | null;
      return (settings?.dailyLimit as number) ?? 5_000;
    }

    return phase.dailyLimit;
  }

  async getDelay(instanceId: string): Promise<number> {
    const ageDays = await this.getInstanceAgeDays(instanceId);
    const phase = this.resolvePhase(ageDays);

    if (!phase) {
      return 500;
    }

    const range = phase.maxDelayMs - phase.minDelayMs;
    return phase.minDelayMs + Math.floor(Math.random() * range);
  }

  async canSend(instanceId: string): Promise<boolean> {
    const limit = await this.getDailyLimit(instanceId);
    const counterKey = this.buildCounterKey(instanceId);

    const currentRaw = await this.redis.get(counterKey);
    const current = currentRaw ? parseInt(currentRaw, 10) : 0;

    if (current >= limit) {
      this.logger.warn('Warm-up daily limit reached', {
        instanceId,
        current,
        limit,
      });
      return false;
    }

    return true;
  }

  async incrementCounter(instanceId: string): Promise<number> {
    const counterKey = this.buildCounterKey(instanceId);

    const count = await this.redis.incrWithTtl(counterKey, 86_400);
    return count;
  }

  private async getInstanceAgeDays(instanceId: string): Promise<number> {
    const cacheKey = `warmup:age:${instanceId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return parseFloat(cached);
    }

    const instance = await this.prisma.instance.findUnique({
      where: { id: instanceId },
      select: { createdAt: true },
    });

    if (!instance) {
      return 0;
    }

    const ageDays =
      (Date.now() - instance.createdAt.getTime()) / (1_000 * 60 * 60 * 24);

    await this.redis.set(cacheKey, String(ageDays), 3_600);

    return ageDays;
  }

  private resolvePhase(ageDays: number): WarmUpPhase | null {
    for (const phase of WARM_UP_PHASES) {
      if (ageDays <= phase.maxDays) {
        return phase;
      }
    }
    return null;
  }

  private buildCounterKey(instanceId: string): string {
    const today = new Date().toISOString().slice(0, 10);
    return `warmup:${instanceId}:${today}`;
  }
}

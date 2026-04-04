import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@nexconnect/database';
import { RedisService } from '@nexconnect/redis';
import { InstancesService } from './instances.service';

const METRICS_CACHE_TTL_SECONDS = 300;
const PERIOD_REGEX = /^(\d+)(h|d|w)$/;
const DEFAULT_PERIOD = '24h';
const PERIOD_MULTIPLIERS: Record<string, number> = {
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

@Injectable()
export class InstanceMetricsService {
  private readonly logger = new Logger(InstanceMetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly instancesService: InstancesService,
  ) {}

  async getHealth(tenantId: string, id: string) {
    const instance = await this.instancesService.findOne(tenantId, id);

    const cachedHealth = await this.redis.get(`instance:${id}:health`);

    if (cachedHealth) {
      return JSON.parse(cachedHealth);
    }

    return {
      instanceId: instance.id,
      status: instance.status,
      uptime: null,
      numberHealth: null,
    };
  }

  async getMetrics(tenantId: string, id: string, period?: string) {
    await this.instancesService.findOne(tenantId, id);

    const effectivePeriod = period ?? DEFAULT_PERIOD;
    const cacheKey = `instance:${id}:metrics:${effectivePeriod}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const since = this.calculateSinceDate(effectivePeriod);

    const [
      messagesReceivedByType,
      messagesSentByType,
      messagesFailed,
      webhookDeliveries,
      healthResult,
      instance,
    ] = await Promise.all([
      this.prisma.message.groupBy({
        by: ['type'],
        where: { instanceId: id, direction: 'INBOUND', createdAt: { gte: since } },
        _count: true,
      }),
      this.prisma.message.groupBy({
        by: ['type', 'status'],
        where: { instanceId: id, direction: 'OUTBOUND', createdAt: { gte: since } },
        _count: true,
      }),
      this.prisma.message.count({
        where: { instanceId: id, status: 'FAILED', createdAt: { gte: since } },
      }),
      this.prisma.webhookDelivery.aggregate({
        where: { webhook: { instanceId: id }, createdAt: { gte: since } },
        _avg: { durationMs: true },
        _max: { durationMs: true },
        _count: true,
      }),
      this.prisma.numberHealth.findUnique({ where: { instanceId: id } }),
      this.prisma.instance.findUnique({
        where: { id },
        select: { createdAt: true, status: true, updatedAt: true },
      }),
    ]);

    const uptimeSeconds =
      instance?.status === 'CONNECTED'
        ? Math.floor(
            (Date.now() - (instance.updatedAt?.getTime() ?? Date.now())) / 1000,
          )
        : 0;

    const reconnectionCount = parseInt(
      (await this.redis.get(`metrics:reconnection:${id}`)) ?? '0',
      10,
    );

    const bufferFlushCount = parseInt(
      (await this.redis.get(`metrics:buffer_flush:${id}`)) ?? '0',
      10,
    );

    const metrics = {
      instanceId: id,
      period: effectivePeriod,
      messagesReceivedTotal: messagesReceivedByType.map((g) => ({
        type: g.type,
        count: g._count,
      })),
      messagesSentTotal: messagesSentByType.map((g) => ({
        type: g.type,
        status: g.status,
        count: g._count,
      })),
      messagesSentFailedTotal: messagesFailed,
      webhookDeliveryLatencyMs: {
        avg: webhookDeliveries._avg.durationMs ?? 0,
        max: webhookDeliveries._max.durationMs ?? 0,
        count: webhookDeliveries._count,
      },
      numberHealthScore: healthResult?.score ?? null,
      connectionUptimeSeconds: uptimeSeconds,
      reconnectionCount,
      bufferFlushCount,
    };

    await this.redis.set(cacheKey, JSON.stringify(metrics), METRICS_CACHE_TTL_SECONDS);

    this.logger.debug({ instanceId: id, period: effectivePeriod }, 'metrics.computed');

    return metrics;
  }

  private calculateSinceDate(period: string): Date {
    const now = new Date();
    const match = period.match(PERIOD_REGEX);

    if (!match) {
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const [, amount, unit] = match;
    const value = parseInt(amount, 10);

    return new Date(now.getTime() - value * PERIOD_MULTIPLIERS[unit]);
  }
}

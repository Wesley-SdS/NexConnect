import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@nexconnect/database';
import { RedisService } from '@nexconnect/redis';
import { WebhookDispatchService } from '../webhooks/webhook-dispatch.service';
import { WebhookEvent } from '@nexconnect/core';

export type ThrottleAction =
  | 'normal'
  | 'light_throttle'
  | 'heavy_throttle'
  | 'pause_proactive';

export interface HealthMetrics {
  responseRate: number;
  readRate: number;
  bounceRate: number;
  instanceAgeDays: number;
  volumeRatio: number;
}

interface NumberHealthResult {
  instanceId: string;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  throttleAction: ThrottleAction;
  factors: {
    responseRate: number;
    readRate: number;
    bounceRate: number;
    instanceAge: number;
    volumeScore: number;
  };
  calculatedAt: string;
}

const INSTANCE_AGE_NORMALIZATION_DAYS = 90;
const IDEAL_DAILY_VOLUME = 100;
const VOLUME_PENALTY_DIVISOR = 5;
const HEALTH_ANALYSIS_WINDOW_DAYS = 7;

const THROTTLE_DELAY_MULTIPLIERS: Record<ThrottleAction, number> = {
  normal: 1.0,
  light_throttle: 1.2,
  heavy_throttle: 2.0,
  pause_proactive: Infinity,
};

@Injectable()
export class NumberHealthCalculatorService {
  private readonly logger = new Logger(NumberHealthCalculatorService.name);

  private static readonly WEIGHTS = {
    responseRate: 0.30,
    readRate: 0.20,
    bounceRate: 0.20,
    instanceAge: 0.15,
    volumeScore: 0.15,
  };

  private static readonly HEALTH_WARNING_THRESHOLD = 40;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly webhookDispatch: WebhookDispatchService,
  ) {}

  calculate(metrics: HealthMetrics): number {
    const instanceAgeNormalized = Math.min(metrics.instanceAgeDays / INSTANCE_AGE_NORMALIZATION_DAYS, 1);
    const volumeScore = metrics.volumeRatio <= 1
      ? 1
      : Math.max(0, 1 - (metrics.volumeRatio - 1) / VOLUME_PENALTY_DIVISOR);
    const bounceScore = 1 - metrics.bounceRate;

    const raw =
      metrics.responseRate * NumberHealthCalculatorService.WEIGHTS.responseRate +
      metrics.readRate * NumberHealthCalculatorService.WEIGHTS.readRate +
      bounceScore * NumberHealthCalculatorService.WEIGHTS.bounceRate +
      instanceAgeNormalized * NumberHealthCalculatorService.WEIGHTS.instanceAge +
      volumeScore * NumberHealthCalculatorService.WEIGHTS.volumeScore;

    return Math.round(Math.max(0, Math.min(100, raw * 100)));
  }

  async calculateForInstance(instanceId: string): Promise<NumberHealthResult> {
    const cacheKey = `health:number:${instanceId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const since = new Date(Date.now() - HEALTH_ANALYSIS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [totalSent, , failed, read, received, instance] =
      await Promise.all([
        this.prisma.message.count({
          where: {
            instanceId,
            direction: 'OUTBOUND',
            createdAt: { gte: since },
          },
        }),
        this.prisma.message.count({
          where: {
            instanceId,
            direction: 'OUTBOUND',
            status: 'DELIVERED',
            createdAt: { gte: since },
          },
        }),
        this.prisma.message.count({
          where: {
            instanceId,
            direction: 'OUTBOUND',
            status: 'FAILED',
            createdAt: { gte: since },
          },
        }),
        this.prisma.message.count({
          where: {
            instanceId,
            direction: 'OUTBOUND',
            status: 'READ',
            createdAt: { gte: since },
          },
        }),
        this.prisma.message.count({
          where: {
            instanceId,
            direction: 'INBOUND',
            createdAt: { gte: since },
          },
        }),
        this.prisma.instance.findUnique({
          where: { id: instanceId },
          select: { createdAt: true },
        }),
      ]);

    const responseRate = totalSent > 0 ? Math.min(received / totalSent, 1) : 0;
    const readRate = totalSent > 0 ? read / totalSent : 0;
    const bounceRate = totalSent > 0 ? failed / totalSent : 0;

    const accountAgeDays = instance
      ? (Date.now() - instance.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      : 0;

    const dailyVolume = totalSent / HEALTH_ANALYSIS_WINDOW_DAYS;
    const volumeRatio = IDEAL_DAILY_VOLUME > 0 ? dailyVolume / IDEAL_DAILY_VOLUME : 1;

    const metrics: HealthMetrics = {
      responseRate,
      readRate,
      bounceRate,
      instanceAgeDays: accountAgeDays,
      volumeRatio,
    };

    const score = this.calculate(metrics);
    const grade = this.scoreToGrade(score);
    const throttleAction = this.getThrottleAction(score);

    const result: NumberHealthResult = {
      instanceId,
      score,
      grade,
      throttleAction,
      factors: {
        responseRate,
        readRate,
        bounceRate,
        instanceAge: Math.min(accountAgeDays / INSTANCE_AGE_NORMALIZATION_DAYS, 1),
        volumeScore: volumeRatio <= 1 ? 1 : Math.max(0, 1 - (volumeRatio - 1) / VOLUME_PENALTY_DIVISOR),
      },
      calculatedAt: new Date().toISOString(),
    };

    // Check if score crossed the health warning threshold
    const previousCacheKey = `health:number:previous:${instanceId}`;
    const previousScoreRaw = await this.redis.get(previousCacheKey);
    const previousScore = previousScoreRaw ? parseInt(previousScoreRaw, 10) : null;

    if (
      previousScore !== null &&
      previousScore > NumberHealthCalculatorService.HEALTH_WARNING_THRESHOLD &&
      score <= NumberHealthCalculatorService.HEALTH_WARNING_THRESHOLD
    ) {
      const inst = await this.prisma.instance.findUnique({
        where: { id: instanceId },
        select: { tenantId: true },
      });

      if (inst) {
        this.logger.warn(
          { instanceId, previousScore, currentScore: score, grade, throttleAction },
          'Health score crossed warning threshold',
        );

        await this.webhookDispatch.dispatchEvent(
          instanceId,
          inst.tenantId,
          WebhookEvent.INSTANCE_HEALTH_WARNING,
          {
            instance_id: instanceId,
            previous_score: previousScore,
            current_score: score,
            grade,
            throttle_action: throttleAction,
            factors: result.factors,
          },
        );
      }
    }

    await this.redis.set(previousCacheKey, String(score), 86400);
    await this.redis.set(cacheKey, JSON.stringify(result), 900);

    this.logger.log(
      { instanceId, score, grade, throttleAction },
      'Number health calculated',
    );

    return result;
  }

  getThrottleAction(score: number): ThrottleAction {
    if (score > 80) return 'normal';
    if (score >= 60) return 'light_throttle';
    if (score >= 40) return 'heavy_throttle';
    return 'pause_proactive';
  }

  getDelayMultiplier(score: number): number {
    const action = this.getThrottleAction(score);
    return THROTTLE_DELAY_MULTIPLIERS[action];
  }

  private scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 75) return 'B';
    if (score >= 60) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }
}

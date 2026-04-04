import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@nexconnect/database';
import { RedisService } from '@nexconnect/redis';

interface NumberHealthResult {
  instanceId: string;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  factors: {
    deliveryRate: number;
    responseRate: number;
    errorRate: number;
    accountAge: number;
    volumeScore: number;
  };
  calculatedAt: string;
}

@Injectable()
export class NumberHealthCalculatorService {
  private readonly logger = new Logger(NumberHealthCalculatorService.name);

  private static readonly WEIGHTS = {
    deliveryRate: 0.35,
    responseRate: 0.20,
    errorRate: 0.25,
    accountAge: 0.10,
    volumeScore: 0.10,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async calculate(instanceId: string): Promise<NumberHealthResult> {
    const cacheKey = `health:number:${instanceId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalSent, delivered, failed, received, instance] = await Promise.all([
      this.prisma.message.count({
        where: { instanceId, direction: 'outbound', createdAt: { gte: since } },
      }),
      this.prisma.message.count({
        where: { instanceId, direction: 'outbound', status: 'delivered', createdAt: { gte: since } },
      }),
      this.prisma.message.count({
        where: { instanceId, direction: 'outbound', status: 'failed', createdAt: { gte: since } },
      }),
      this.prisma.message.count({
        where: { instanceId, direction: 'inbound', createdAt: { gte: since } },
      }),
      this.prisma.instance.findUnique({
        where: { id: instanceId },
        select: { createdAt: true },
      }),
    ]);

    const deliveryRate = totalSent > 0 ? delivered / totalSent : 1;
    const errorRate = totalSent > 0 ? 1 - (failed / totalSent) : 1;
    const responseRate = totalSent > 0
      ? Math.min(received / totalSent, 1)
      : 0;

    const accountAgeDays = instance
      ? (Date.now() - instance.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      : 0;
    const accountAge = Math.min(accountAgeDays / 90, 1);

    const idealDailyVolume = 100;
    const dailyVolume = totalSent / 7;
    const volumeScore = dailyVolume <= idealDailyVolume
      ? 1
      : Math.max(0, 1 - (dailyVolume - idealDailyVolume) / (idealDailyVolume * 5));

    const factors = {
      deliveryRate,
      responseRate,
      errorRate,
      accountAge,
      volumeScore,
    };

    const score = Math.round(
      (factors.deliveryRate * NumberHealthCalculatorService.WEIGHTS.deliveryRate +
        factors.responseRate * NumberHealthCalculatorService.WEIGHTS.responseRate +
        factors.errorRate * NumberHealthCalculatorService.WEIGHTS.errorRate +
        factors.accountAge * NumberHealthCalculatorService.WEIGHTS.accountAge +
        factors.volumeScore * NumberHealthCalculatorService.WEIGHTS.volumeScore) *
        100,
    );

    const grade = this.scoreToGrade(score);

    const result: NumberHealthResult = {
      instanceId,
      score,
      grade,
      factors,
      calculatedAt: new Date().toISOString(),
    };

    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 900);

    this.logger.log({ instanceId, score, grade }, 'Number health calculated');

    return result;
  }

  private scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 75) return 'B';
    if (score >= 60) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }
}

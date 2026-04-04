import { Injectable } from '@nestjs/common';
import { PrismaService } from '@nexconnect/database';
import { IBroadcastStrategy } from './broadcast-strategy.interface';

@Injectable()
export class HealthBasedStrategy implements IBroadcastStrategy {
  constructor(private readonly prisma: PrismaService) {}

  async selectInstance(pool: string[], index: number): Promise<string> {
    const healthScores = await Promise.all(
      pool.map(async (instanceId) => {
        const health = await this.prisma.numberHealth.findUnique({
          where: { instanceId },
          select: { score: true },
        });
        return { instanceId, score: health?.score ?? 100 };
      }),
    );

    const sorted = healthScores.sort((a, b) => b.score - a.score);
    return sorted[index % sorted.length].instanceId;
  }
}

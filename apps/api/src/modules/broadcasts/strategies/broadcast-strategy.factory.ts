import { Injectable } from '@nestjs/common';
import { IBroadcastStrategy } from './broadcast-strategy.interface';
import { RoundRobinStrategy } from './round-robin.strategy';
import { HealthBasedStrategy } from './health-based.strategy';
import { RandomStrategy } from './random.strategy';

export type BroadcastStrategyType = 'round_robin' | 'health_based' | 'random';

@Injectable()
export class BroadcastStrategyFactory {
  constructor(
    private readonly roundRobin: RoundRobinStrategy,
    private readonly healthBased: HealthBasedStrategy,
    private readonly random: RandomStrategy,
  ) {}

  getStrategy(type: BroadcastStrategyType): IBroadcastStrategy {
    const strategies: Record<BroadcastStrategyType, IBroadcastStrategy> = {
      round_robin: this.roundRobin,
      health_based: this.healthBased,
      random: this.random,
    };

    return strategies[type] ?? this.roundRobin;
  }
}

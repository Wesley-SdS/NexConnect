import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '@nexconnect/database';
import { BroadcastsController } from './broadcasts.controller';
import { BroadcastsService } from './broadcasts.service';
import { InstancesModule } from '../instances/instances.module';
import { BroadcastStrategyFactory } from './strategies/broadcast-strategy.factory';
import { RoundRobinStrategy } from './strategies/round-robin.strategy';
import { HealthBasedStrategy } from './strategies/health-based.strategy';
import { RandomStrategy } from './strategies/random.strategy';

@Module({
  imports: [
    DatabaseModule,
    InstancesModule,
    BullModule.registerQueue({ name: 'broadcast-messages' }),
  ],
  controllers: [BroadcastsController],
  providers: [
    BroadcastsService,
    BroadcastStrategyFactory,
    RoundRobinStrategy,
    HealthBasedStrategy,
    RandomStrategy,
  ],
  exports: [BroadcastsService],
})
export class BroadcastsModule {}

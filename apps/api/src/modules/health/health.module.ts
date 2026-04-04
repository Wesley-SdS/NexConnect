import { Module } from '@nestjs/common';
import { DatabaseModule } from '@nexconnect/database';
import { RedisModule } from '@nexconnect/redis';
import { HealthController } from './health.controller';
import { NumberHealthCalculatorService } from './number-health-calculator.service';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [HealthController],
  providers: [NumberHealthCalculatorService],
  exports: [NumberHealthCalculatorService],
})
export class HealthModule {}

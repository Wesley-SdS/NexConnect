import { Module } from '@nestjs/common';
import { DatabaseModule } from '@nexconnect/database';
import { RedisModule } from '@nexconnect/redis';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { HealthCheckService } from './health-check.service';
import { HealthController } from './health.controller';
import { NumberHealthCalculatorService } from './number-health-calculator.service';

@Module({
  imports: [DatabaseModule, RedisModule, WebhooksModule],
  controllers: [HealthController],
  providers: [HealthCheckService, NumberHealthCalculatorService],
  exports: [HealthCheckService, NumberHealthCalculatorService],
})
export class HealthModule {}

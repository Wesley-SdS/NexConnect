import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '@nexconnect/database';
import { RedisModule } from '@nexconnect/redis';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookDispatchService } from './webhook-dispatch.service';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    BullModule.registerQueue({ name: 'webhook-dispatch' }),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookDispatchService],
  exports: [WebhooksService, WebhookDispatchService],
})
export class WebhooksModule {}

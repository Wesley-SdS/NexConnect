import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { ConnectionModule } from './connection/connection.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { MessageProcessorWorker } from './workers/message-processor.worker';
import { OutboundMessageWorker } from './workers/outbound-message.worker';
import { WebhookDeliveryWorker } from './workers/webhook-delivery.worker';
import { ScheduledMessageWorker } from './workers/scheduled-message.worker';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        level: process.env.LOG_LEVEL ?? 'info',
      },
    }),
    EventEmitterModule.forRoot(),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB ?? '0', 10),
      },
    }),
    BullModule.registerQueue(
      { name: 'inbound-messages' },
      { name: 'outbound-messages' },
      { name: 'webhook-delivery' },
      { name: 'scheduled-messages' },
    ),
    ConnectionModule,
    PipelineModule,
  ],
  providers: [
    MessageProcessorWorker,
    OutboundMessageWorker,
    WebhookDeliveryWorker,
    ScheduledMessageWorker,
  ],
})
export class WorkerModule {}

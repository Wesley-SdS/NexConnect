import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import { DatabaseModule } from '@nexconnect/database';
import { RedisModule } from '@nexconnect/redis';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { InstancesModule } from './modules/instances/instances.module';
import { MessagesModule } from './modules/messages/messages.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { GroupsModule } from './modules/groups/groups.module';
import { MediaModule } from './modules/media/media.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { BroadcastsModule } from './modules/broadcasts/broadcasts.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        redact: ['req.headers.authorization'],
      },
    }),

    DatabaseModule,
    RedisModule,

    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        password: process.env.REDIS_PASSWORD,
      },
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    }),

    AuthModule,
    TenantsModule,
    InstancesModule,
    MessagesModule,
    WebhooksModule,
    GroupsModule,
    MediaModule,
    SchedulingModule,
    BroadcastsModule,
    HealthModule,
  ],
})
export class AppModule {}

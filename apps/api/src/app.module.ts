import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { DatabaseModule } from '@nexconnect/database';
import { RedisModule } from '@nexconnect/redis';
import { TracingModule, AuditModule } from '@nexconnect/shared';
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
import { MetricsModule } from './modules/metrics/metrics.module';
import { AuditApiModule } from './modules/audit/audit.module';
import { VerificationModule } from './modules/verification/verification.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { SandboxModule } from './modules/sandbox/sandbox.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { MetaModule } from './modules/meta/meta.module';
import { TwilioModule } from './modules/twilio/twilio.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { ProviderMetricsModule } from '@nexconnect/shared';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { PiiRedactionInterceptor } from './common/interceptors/pii-redaction.interceptor';
import { ApiVersionInterceptor } from './common/interceptors/api-version.interceptor';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { GracefulShutdownService } from './common/lifecycle/graceful-shutdown.service';

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

    ScheduleModule.forRoot(),
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

    TracingModule,
    AuditModule,
    MetricsModule,
    AuditApiModule,

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
    VerificationModule,
    ChannelsModule,
    SandboxModule,
    ProviderMetricsModule,
    ProvidersModule,
    MetaModule,
    TwilioModule,
    TelegramModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PiiRedactionInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiVersionInterceptor,
    },
    GracefulShutdownService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '@nexconnect/database';
import { ProvidersModule } from '../providers/providers.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { TelegramClient } from './telegram.client';
import { TelegramMapper } from './telegram.mapper';
import { TelegramInboundMapper } from './telegram-inbound.mapper';
import { TelegramProvider } from './telegram.provider';
import { TelegramLifecycleService } from './telegram-lifecycle.service';
import { TelegramWebhookService } from './webhooks/telegram-webhook.service';
import { TelegramWebhookController } from './webhooks/telegram-webhook.controller';
import { TelegramSecretTokenGuard } from './webhooks/telegram-secret-token.guard';

@Module({
  imports: [DatabaseModule, WebhooksModule, forwardRef(() => ProvidersModule)],
  controllers: [TelegramWebhookController],
  providers: [
    TelegramClient,
    TelegramMapper,
    TelegramInboundMapper,
    TelegramProvider,
    TelegramLifecycleService,
    TelegramWebhookService,
    TelegramSecretTokenGuard,
  ],
  exports: [TelegramProvider, TelegramLifecycleService, TelegramWebhookService],
})
export class TelegramModule {}

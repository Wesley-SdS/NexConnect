import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '@nexconnect/database';
import { ProvidersModule } from '../providers/providers.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { DiscordClient } from './discord.client';
import { DiscordMapper } from './discord.mapper';
import { DiscordInboundMapper } from './discord-inbound.mapper';
import { DiscordProvider } from './discord.provider';
import { DiscordLifecycleService } from './discord-lifecycle.service';
import { DiscordInteractionsController } from './webhooks/discord-interactions.controller';
import { DiscordEd25519Guard } from './webhooks/discord-ed25519.guard';
import { DiscordWebhookService } from './webhooks/discord-webhook.service';

@Module({
  imports: [DatabaseModule, WebhooksModule, forwardRef(() => ProvidersModule)],
  controllers: [DiscordInteractionsController],
  providers: [
    DiscordClient,
    DiscordMapper,
    DiscordInboundMapper,
    DiscordProvider,
    DiscordLifecycleService,
    DiscordWebhookService,
    DiscordEd25519Guard,
  ],
  exports: [DiscordProvider, DiscordLifecycleService, DiscordWebhookService],
})
export class DiscordModule {}

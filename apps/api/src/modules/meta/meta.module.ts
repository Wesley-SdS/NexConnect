import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '@nexconnect/database';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { MediaModule } from '../media/media.module';
import { ProvidersModule } from '../providers/providers.module';
import { MetaHttpClientFactory } from './shared/meta-http-client.factory';
import { MetaCredentialLifecycle } from './shared/meta-lifecycle.service';
import { WhatsAppCloudClient } from './whatsapp-cloud/whatsapp-cloud.client';
import { WhatsAppCloudMapper } from './whatsapp-cloud/whatsapp-cloud.mapper';
import { WhatsAppCloudProvider } from './whatsapp-cloud/whatsapp-cloud.provider';
import { WhatsAppMediaService } from './whatsapp-cloud/whatsapp-media.service';
import { WhatsAppTemplateService } from './whatsapp-cloud/whatsapp-template.service';
import { WhatsAppCallingService } from './whatsapp-cloud/whatsapp-calling.service';
import { WhatsAppInboundMapper } from './whatsapp-cloud/whatsapp-inbound.mapper';
import { InstagramClient } from './instagram/instagram.client';
import { InstagramMapper } from './instagram/instagram.mapper';
import { InstagramProvider } from './instagram/instagram.provider';
import { InstagramInboundMapper } from './instagram/instagram-inbound.mapper';
import { MessengerClient } from './messenger/messenger.client';
import { MessengerProvider } from './messenger/messenger.provider';
import { MessengerInboundMapper } from './messenger/messenger-inbound.mapper';
import { MetaWebhookController } from './webhooks/meta-webhook.controller';
import { MetaSignatureGuard } from './webhooks/meta-signature.guard';
import { MetaWebhookService } from './webhooks/meta-webhook.service';

@Module({
  imports: [DatabaseModule, WebhooksModule, MediaModule, forwardRef(() => ProvidersModule)],
  controllers: [MetaWebhookController],
  providers: [
    MetaHttpClientFactory,
    MetaCredentialLifecycle,
    // WhatsApp Cloud
    WhatsAppCloudClient,
    WhatsAppCloudMapper,
    WhatsAppCloudProvider,
    WhatsAppMediaService,
    WhatsAppTemplateService,
    WhatsAppCallingService,
    WhatsAppInboundMapper,
    // Instagram
    InstagramClient,
    InstagramMapper,
    InstagramProvider,
    InstagramInboundMapper,
    // Messenger
    MessengerClient,
    MessengerProvider,
    MessengerInboundMapper,
    // Webhook pipeline
    MetaSignatureGuard,
    MetaWebhookService,
  ],
  exports: [
    WhatsAppCloudProvider,
    WhatsAppMediaService,
    WhatsAppTemplateService,
    WhatsAppCallingService,
    MetaCredentialLifecycle,
    MetaWebhookService,
    InstagramProvider,
    MessengerProvider,
  ],
})
export class MetaModule {}

import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '@nexconnect/database';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { MediaModule } from '../media/media.module';
import { ProvidersModule } from '../providers/providers.module';
import { TwilioClientFactory } from './twilio-client.factory';
import { TwilioMessagingMapper } from './twilio-messaging.mapper';
import {
  TwilioSmsProvider,
  TwilioWhatsAppProvider,
} from './twilio-messaging.provider';
import { TwilioVoiceService } from './services/twilio-voice.service';
import { TwilioVerifyService } from './services/twilio-verify.service';
import { TwilioInboundMapper } from './webhooks/twilio-inbound.mapper';
import { TwilioSignatureGuard } from './webhooks/twilio-signature.guard';
import { TwilioWebhookService } from './webhooks/twilio-webhook.service';
import { TwilioWebhookController } from './webhooks/twilio-webhook.controller';

@Module({
  imports: [DatabaseModule, WebhooksModule, MediaModule, forwardRef(() => ProvidersModule)],
  controllers: [TwilioWebhookController],
  providers: [
    TwilioClientFactory,
    TwilioMessagingMapper,
    TwilioSmsProvider,
    TwilioWhatsAppProvider,
    TwilioVoiceService,
    TwilioVerifyService,
    TwilioInboundMapper,
    TwilioSignatureGuard,
    TwilioWebhookService,
  ],
  exports: [
    TwilioSmsProvider,
    TwilioWhatsAppProvider,
    TwilioVoiceService,
    TwilioVerifyService,
  ],
})
export class TwilioModule {}

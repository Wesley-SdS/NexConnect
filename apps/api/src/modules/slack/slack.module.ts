import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '@nexconnect/database';
import { ProvidersModule } from '../providers/providers.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { SlackClient } from './slack.client';
import { SlackMapper } from './slack.mapper';
import { SlackInboundMapper } from './slack-inbound.mapper';
import { SlackProvider } from './slack.provider';
import { SlackLifecycleService } from './slack-lifecycle.service';
import { SlackEventsController } from './webhooks/slack-events.controller';
import { SlackInteractivityController } from './webhooks/slack-interactivity.controller';
import { SlackCommandsController } from './webhooks/slack-commands.controller';
import { SlackSignatureGuard } from './webhooks/slack-signature.guard';
import { SlackWebhookService } from './webhooks/slack-webhook.service';

@Module({
  imports: [DatabaseModule, WebhooksModule, forwardRef(() => ProvidersModule)],
  controllers: [
    SlackEventsController,
    SlackInteractivityController,
    SlackCommandsController,
  ],
  providers: [
    SlackClient,
    SlackMapper,
    SlackInboundMapper,
    SlackProvider,
    SlackLifecycleService,
    SlackWebhookService,
    SlackSignatureGuard,
  ],
  exports: [SlackProvider, SlackLifecycleService],
})
export class SlackModule {}

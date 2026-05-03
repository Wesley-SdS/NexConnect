import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '@nexconnect/database';
import { MetaModule } from '../meta/meta.module';
import { TwilioModule } from '../twilio/twilio.module';
import { TelegramModule } from '../telegram/telegram.module';
import { DiscordModule } from '../discord/discord.module';
import { SlackModule } from '../slack/slack.module';
import { WebhookReplayController } from './webhook-replay.controller';

/**
 * Replay controller lives in its own module to avoid cycles with the
 * inbound webhook receivers (each provider module already depends on
 * WebhooksModule for outbound dispatch). Importing the channel modules
 * here lets the controller invoke their *WebhookService.
 */
@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => MetaModule),
    forwardRef(() => TwilioModule),
    forwardRef(() => TelegramModule),
    forwardRef(() => DiscordModule),
    forwardRef(() => SlackModule),
  ],
  controllers: [WebhookReplayController],
})
export class WebhookReplayModule {}

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProviderType } from '@nexconnect/core';
import { PrismaService } from '@nexconnect/database';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { MetaWebhookService } from '../meta/webhooks/meta-webhook.service';
import { TwilioWebhookService } from '../twilio/webhooks/twilio-webhook.service';
import { TelegramWebhookService } from '../telegram/webhooks/telegram-webhook.service';
import { DiscordWebhookService } from '../discord/webhooks/discord-webhook.service';
import { SlackWebhookService } from '../slack/webhooks/slack-webhook.service';

interface ReplayBody {
  /** ID of an InboundWebhookEvent row to re-deliver. */
  eventId: string;
}

/**
 * Re-delivers a previously received provider webhook event by reading
 * its raw payload + headers from the inbound_webhook_events log. Skips
 * signature validation (we already validated when it was first
 * received) and instead requires admin scope + tenant ownership.
 */
@ApiTags('Webhooks')
@ApiBearerAuth()
@Controller('webhooks/replay')
export class WebhookReplayController {
  private readonly logger = new Logger(WebhookReplayController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly meta: MetaWebhookService,
    private readonly twilio: TwilioWebhookService,
    private readonly telegram: TelegramWebhookService,
    private readonly discord: DiscordWebhookService,
    private readonly slack: SlackWebhookService,
  ) {}

  @Post()
  @RequiredScopes('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-deliver a stored inbound webhook event' })
  async replay(
    @CurrentTenant() tenant: { id: string },
    @Body() body: ReplayBody,
  ): Promise<{ ok: true; provider: string; eventId: string }> {
    const event = await this.prisma.inboundWebhookEvent.findFirst({
      where: { id: body.eventId, tenantId: tenant.id },
    });
    if (!event) {
      throw new NotFoundException(`InboundWebhookEvent ${body.eventId} not found for this tenant`);
    }

    const provider = event.provider as unknown as ProviderType;
    const headers = (event.headers as Record<string, string>) ?? {};
    const payload = event.rawPayload as unknown;
    const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');

    this.logger.log(
      { eventId: event.id, provider, tenantId: tenant.id },
      'webhook.replay.start',
    );

    switch (provider) {
      case ProviderType.META_WHATSAPP_CLOUD:
      case ProviderType.META_INSTAGRAM:
      case ProviderType.META_MESSENGER:
        await this.meta.handle(payload as never, rawBody, headers);
        break;
      case ProviderType.TWILIO_SMS:
      case ProviderType.TWILIO_WHATSAPP:
      case ProviderType.TWILIO_VOICE:
      case ProviderType.TWILIO_VERIFY:
      case ProviderType.TWILIO_RCS: {
        const stringHeaders = Object.fromEntries(
          Object.entries(headers).map(([k, v]) => [k, String(v)]),
        );
        await this.twilio.handleInboundMessage(payload as never, stringHeaders);
        break;
      }
      case ProviderType.TELEGRAM:
        await this.telegram.handleUpdate(
          this.requireCredentialId(event),
          payload as never,
          rawBody,
          headers,
        );
        break;
      case ProviderType.DISCORD:
        await this.discord.handleInteraction(
          this.requireCredentialId(event),
          payload as never,
          rawBody,
          headers,
        );
        break;
      case ProviderType.SLACK:
        await this.slack.handleEvent(
          this.requireCredentialId(event),
          payload as never,
          headers,
        );
        break;
      default:
        throw new NotFoundException(`Unsupported provider for replay: ${provider}`);
    }

    return { ok: true, provider, eventId: event.id };
  }

  private requireCredentialId(event: { externalId: string | null }): string {
    if (!event.externalId) {
      throw new NotFoundException('Replay requires the event to have an externalId/credentialId.');
    }
    return event.externalId;
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  InboundMessage,
  InboundStatusUpdate,
  ProviderType,
  WebhookEvent,
} from '@nexconnect/core';
import { PrismaService } from '@nexconnect/database';
import { $Enums, Prisma } from '@prisma/client';
import { WebhookDispatchService } from '../../webhooks/webhook-dispatch.service';
import {
  CREDENTIAL_RESOLVER,
  CredentialResolver,
} from '../../providers/credential.resolver';
import { ProviderMediaIngestionService } from '../../providers/provider-media-ingestion.service';
import {
  TwilioInboundMessageWebhook,
  TwilioMessageStatusWebhook,
  TwilioVoiceStatusWebhook,
} from '../types/twilio.types';
import { TwilioInboundMapper } from './twilio-inbound.mapper';

type Owner = {
  credentialId: string;
  tenantId: string;
  instanceId: string | null;
  provider: ProviderType;
};

@Injectable()
export class TwilioWebhookService {
  private readonly logger = new Logger(TwilioWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatch: WebhookDispatchService,
    private readonly mapper: TwilioInboundMapper,
    private readonly mediaIngestion: ProviderMediaIngestionService,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  async handleInboundMessage(body: TwilioInboundMessageWebhook, headers: Record<string, string>) {
    const owner = await this.credentials.findByAccountSid(body.AccountSid);
    if (!owner) {
      await this.log(null, 'inbound-message', body, headers, 'unknown_owner');
      return;
    }
    const provider = this.inferProvider(owner, body.From);
    const inbound = this.mapper.mapInboundMessage(body, provider);
    await this.persistInbound({ ...owner, provider }, inbound);
    await this.log(owner.tenantId, 'inbound-message', body, headers, null, body.MessageSid);
  }

  async handleMessageStatus(body: TwilioMessageStatusWebhook, headers: Record<string, string>) {
    const owner = await this.credentials.findByAccountSid(body.AccountSid);
    if (!owner) {
      await this.log(null, 'status', body, headers, 'unknown_owner');
      return;
    }
    const provider = this.inferProvider(owner, body.To);
    const update = this.mapper.mapStatusUpdate(body, provider);
    if (update) {
      await this.applyStatus({ ...owner, provider }, update);
    }
    await this.log(owner.tenantId, 'status', body, headers, null, body.MessageSid);
  }

  async handleVoiceStatus(body: TwilioVoiceStatusWebhook, headers: Record<string, string>) {
    const owner = await this.credentials.findByAccountSid(body.AccountSid);
    if (!owner) {
      await this.log(null, 'voice-status', body, headers, 'unknown_owner');
      return;
    }
    if (owner.instanceId) {
      await this.dispatch.dispatchEvent(
        owner.instanceId,
        owner.tenantId,
        WebhookEvent.INSTANCE_MENTIONED,
        {
          provider: ProviderType.TWILIO_VOICE,
          call_sid: body.CallSid,
          status: body.CallStatus,
          from: body.From,
          to: body.To,
          duration: body.CallDuration ?? body.Duration,
          recording_url: body.RecordingUrl,
          recording_sid: body.RecordingSid,
          timestamp: body.Timestamp,
        },
      );
    }
    await this.log(owner.tenantId, 'voice-status', body, headers, null, body.CallSid);
  }

  private inferProvider(owner: Owner, address: string | undefined): ProviderType {
    if (address?.startsWith('whatsapp:')) return ProviderType.TWILIO_WHATSAPP;
    return owner.provider === ProviderType.TWILIO_WHATSAPP
      ? ProviderType.TWILIO_WHATSAPP
      : ProviderType.TWILIO_SMS;
  }

  private async persistInbound(owner: Owner, inbound: InboundMessage) {
    if (!owner.instanceId) {
      this.logger.warn(
        { credentialId: owner.credentialId, messageSid: inbound.providerMessageId },
        'twilio.webhook.inbound.no-instance',
      );
      return;
    }

    const providerEnum = owner.provider as unknown as $Enums.ProviderType;
    const typeEnum = inbound.type as unknown as $Enums.MessageType;

    const message = await this.prisma.message.upsert({
      where: { waMessageId: inbound.providerMessageId },
      create: {
        id: inbound.providerMessageId,
        instanceId: owner.instanceId,
        tenantId: owner.tenantId,
        waMessageId: inbound.providerMessageId,
        provider: providerEnum,
        externalId: inbound.providerMessageId,
        fromAddress: inbound.fromAddress,
        toAddress: inbound.toAddress,
        direction: 'INBOUND',
        type: typeEnum,
        content: this.buildContent(inbound),
        status: 'DELIVERED',
        metadata: (inbound.metadata ?? {}) as Prisma.InputJsonValue,
        sentAt: inbound.timestamp,
        deliveredAt: inbound.timestamp,
      },
      update: {},
    });

    await this.prisma.externalMessageMapping.upsert({
      where: {
        provider_externalMessageId: {
          provider: providerEnum,
          externalMessageId: inbound.providerMessageId,
        },
      },
      create: {
        tenantId: owner.tenantId,
        instanceId: owner.instanceId,
        provider: providerEnum,
        externalMessageId: inbound.providerMessageId,
        internalMessageId: message.id,
      },
      update: { internalMessageId: message.id },
    });

    await this.dispatch.dispatchEvent(
      owner.instanceId,
      owner.tenantId,
      WebhookEvent.MESSAGE_RECEIVED,
      {
        message_id: message.id,
        provider: owner.provider,
        from: inbound.fromAddress,
        to: inbound.toAddress,
        type: inbound.type,
        content: message.content,
        timestamp: inbound.timestamp.toISOString(),
        contact: inbound.contact,
      },
    );

    // Twilio MMS/WhatsApp attachments live on api.twilio.com for a limited
    // time; download and persist to R2 asynchronously.
    if (inbound.media?.url) {
      void this.mediaIngestion.ingest({
        tenantId: owner.tenantId,
        instanceId: owner.instanceId,
        credentialId: owner.credentialId,
        messageId: message.id,
        provider: owner.provider,
        mediaUrl: inbound.media.url,
        mimeType: inbound.media.mimeType,
        caption: inbound.media.caption,
      });
    }
  }

  private async applyStatus(owner: Owner, update: InboundStatusUpdate) {
    const mapping = await this.prisma.externalMessageMapping.findUnique({
      where: {
        provider_externalMessageId: {
          provider: owner.provider as unknown as $Enums.ProviderType,
          externalMessageId: update.providerMessageId,
        },
      },
    });
    const messageId = mapping?.internalMessageId ?? update.providerMessageId;

    const patch: Prisma.MessageUpdateInput = {
      status:
        update.status === 'SENT'
          ? 'SENT'
          : update.status === 'DELIVERED'
            ? 'DELIVERED'
            : update.status === 'READ'
              ? 'READ'
              : 'FAILED',
    };
    if (update.status === 'SENT') patch.sentAt = update.timestamp;
    if (update.status === 'DELIVERED') patch.deliveredAt = update.timestamp;
    if (update.status === 'READ') patch.readAt = update.timestamp;
    if (update.status === 'FAILED') {
      patch.failedAt = update.timestamp;
      patch.errorCode = update.errorCode;
      patch.errorReason = update.errorReason;
    }

    try {
      await this.prisma.message.update({ where: { id: messageId }, data: patch });
    } catch {
      this.logger.debug({ messageId }, 'twilio.webhook.status.message-not-found');
    }

    if (!owner.instanceId) return;
    const eventType: WebhookEvent | null =
      update.status === 'SENT'
        ? WebhookEvent.MESSAGE_SENT
        : update.status === 'DELIVERED'
          ? WebhookEvent.MESSAGE_DELIVERED
          : update.status === 'READ'
            ? WebhookEvent.MESSAGE_READ
            : null;
    if (eventType) {
      await this.dispatch.dispatchEvent(owner.instanceId, owner.tenantId, eventType, {
        message_id: messageId,
        provider: owner.provider,
        status: update.status,
        recipient_id: update.recipientId,
        timestamp: update.timestamp.toISOString(),
      });
    }
  }

  private buildContent(inbound: InboundMessage): Prisma.InputJsonValue {
    return {
      type: inbound.type,
      text: inbound.text,
      media: inbound.media,
      location: inbound.location,
      reaction: inbound.reaction,
      interactive: inbound.interactive,
      reply_to: inbound.replyTo,
    } as Prisma.InputJsonValue;
  }

  private async log(
    tenantId: string | null,
    eventType: string,
    body: unknown,
    headers: Record<string, string>,
    error: string | null,
    externalId?: string,
  ) {
    try {
      await this.prisma.inboundWebhookEvent.create({
        data: {
          tenantId: tenantId ?? undefined,
          provider: ProviderType.TWILIO_SMS as unknown as $Enums.ProviderType,
          eventType,
          externalId,
          headers: headers as unknown as Prisma.InputJsonValue,
          rawPayload: body as Prisma.InputJsonValue,
          status: error ? 'DISCARDED' : 'PROCESSED',
          error,
          processedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error({ err: (err as Error).message }, 'twilio.webhook.raw-log-failed');
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import {
  InboundMessage,
  InboundStatusUpdate,
  ProviderType,
  WebhookEvent,
} from '@nexconnect/core';
import { PrismaService } from '@nexconnect/database';
import { $Enums, Prisma } from '@prisma/client';
import { WebhookDispatchService } from '../../webhooks/webhook-dispatch.service';
import { CredentialResolver } from '../../providers/credential.resolver';
import { Inject } from '@nestjs/common';
import { CREDENTIAL_RESOLVER } from '../../providers/credential.resolver';
import { ProviderMediaIngestionService } from '../../providers/provider-media-ingestion.service';
import { ConversationPricingService } from '../../providers/conversation-pricing.service';
import { WhatsAppInboundMapper } from '../whatsapp-cloud/whatsapp-inbound.mapper';
import { InstagramInboundMapper } from '../instagram/instagram-inbound.mapper';
import { MessengerInboundMapper } from '../messenger/messenger-inbound.mapper';
import {
  GraphWebhookPayload,
  GraphWhatsAppChangeValue,
} from '../types/graph-api.types';

type ResolvedOwner = {
  credentialId: string;
  tenantId: string;
  instanceId: string | null;
  provider: ProviderType;
};

@Injectable()
export class MetaWebhookService {
  private readonly logger = new Logger(MetaWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsAppMapper: WhatsAppInboundMapper,
    private readonly instagramMapper: InstagramInboundMapper,
    private readonly messengerMapper: MessengerInboundMapper,
    private readonly dispatch: WebhookDispatchService,
    private readonly mediaIngestion: ProviderMediaIngestionService,
    private readonly pricing: ConversationPricingService,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  async handle(
    payload: GraphWebhookPayload,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ accepted: number }> {
    let accepted = 0;

    for (const entry of payload.entry) {
      if (payload.object === 'whatsapp_business_account') {
        accepted += await this.handleWhatsApp(entry, rawBody, headers);
      } else if (payload.object === 'instagram') {
        accepted += await this.handleInstagram(entry, rawBody, headers);
      } else if (payload.object === 'page') {
        accepted += await this.handleMessenger(entry, rawBody, headers);
      } else {
        this.logger.warn({ object: payload.object }, 'meta.webhook.unknown-object');
      }
    }

    return { accepted };
  }

  private async handleWhatsApp(
    entry: GraphWebhookPayload['entry'][number],
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<number> {
    let count = 0;
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue;
      const value = change.value as GraphWhatsAppChangeValue;
      const phoneNumberId = value.metadata.phone_number_id;

      const owner = await this.credentials.findByExternalPhoneId(phoneNumberId);
      if (!owner) {
        await this.logRawEvent(null, ProviderType.META_WHATSAPP_CLOUD, 'messages', rawBody, headers, 'unknown_owner');
        this.logger.warn({ phoneNumberId }, 'meta.webhook.unknown-phone-number-id');
        continue;
      }

      const { messages, statuses } = this.whatsAppMapper.mapValue(value);
      for (const inbound of messages) {
        await this.persistInbound(owner, inbound);
        count++;
      }
      for (const status of statuses) {
        await this.applyStatusUpdate(owner, status);
        count++;
      }
      await this.logRawEvent(
        owner.tenantId,
        ProviderType.META_WHATSAPP_CLOUD,
        'messages',
        rawBody,
        headers,
        null,
        phoneNumberId,
      );
    }
    return count;
  }

  private async handleInstagram(
    entry: GraphWebhookPayload['entry'][number],
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<number> {
    const pageId = entry.id;
    const owner = await this.credentials.findByPageId(pageId);
    if (!owner) {
      await this.logRawEvent(null, ProviderType.META_INSTAGRAM, 'messaging', rawBody, headers, 'unknown_owner');
      return 0;
    }

    let count = 0;
    if (entry.messaging) {
      const result = this.instagramMapper.mapMessaging(entry.messaging, pageId);
      for (const inbound of result.messages) {
        await this.persistInbound(owner, inbound);
        count++;
      }
      for (const status of result.statuses) {
        await this.applyStatusUpdate(owner, status);
        count++;
      }
    }

    await this.logRawEvent(
      owner.tenantId,
      ProviderType.META_INSTAGRAM,
      'messaging',
      rawBody,
      headers,
      null,
      pageId,
    );
    return count;
  }

  private async handleMessenger(
    entry: GraphWebhookPayload['entry'][number],
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<number> {
    const pageId = entry.id;
    const owner = await this.credentials.findByPageId(pageId);
    if (!owner) {
      await this.logRawEvent(null, ProviderType.META_MESSENGER, 'messaging', rawBody, headers, 'unknown_owner');
      return 0;
    }

    let count = 0;
    if (entry.messaging) {
      const result = this.messengerMapper.mapMessaging(entry.messaging, pageId);
      for (const inbound of result.messages) {
        await this.persistInbound(owner, inbound);
        count++;
      }
      for (const status of result.statuses) {
        await this.applyStatusUpdate(owner, status);
        count++;
      }
    }

    await this.logRawEvent(
      owner.tenantId,
      ProviderType.META_MESSENGER,
      'messaging',
      rawBody,
      headers,
      null,
      pageId,
    );
    return count;
  }

  private async persistInbound(owner: ResolvedOwner, inbound: InboundMessage): Promise<void> {
    if (!owner.instanceId) {
      this.logger.warn(
        { credentialId: owner.credentialId, providerMessageId: inbound.providerMessageId },
        'meta.webhook.inbound.no-instance-bound',
      );
      return;
    }

    try {
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

      // Fire-and-forget media ingestion: download from Meta and upload to
      // R2 in the background. Keeps the webhook ACK under Meta's 20s SLA.
      if (inbound.media && (inbound.media.providerMediaId || inbound.media.url)) {
        void this.mediaIngestion.ingest({
          tenantId: owner.tenantId,
          instanceId: owner.instanceId,
          credentialId: owner.credentialId,
          messageId: message.id,
          provider: owner.provider,
          providerMediaId: inbound.media.providerMediaId,
          mediaUrl: inbound.media.url,
          mimeType: inbound.media.mimeType,
          caption: inbound.media.caption,
        });
      }
    } catch (err) {
      this.logger.error(
        { err: (err as Error).message, providerMessageId: inbound.providerMessageId },
        'meta.webhook.inbound.persist-failed',
      );
      throw err;
    }
  }

  private async applyStatusUpdate(
    owner: ResolvedOwner,
    status: InboundStatusUpdate,
  ): Promise<void> {
    const mapping = await this.prisma.externalMessageMapping.findUnique({
      where: {
        provider_externalMessageId: {
          provider: owner.provider,
          externalMessageId: status.providerMessageId,
        },
      },
    });

    const messageId = mapping?.internalMessageId ?? status.providerMessageId;

    const updates: Prisma.MessageUpdateInput = {
      status: this.mapStatus(status.status),
    };
    if (status.status === 'SENT') updates.sentAt = status.timestamp;
    if (status.status === 'DELIVERED') updates.deliveredAt = status.timestamp;
    if (status.status === 'READ') updates.readAt = status.timestamp;
    if (status.status === 'FAILED') {
      updates.failedAt = status.timestamp;
      updates.errorCode = status.errorCode;
      updates.errorReason = status.errorReason;
    }

    try {
      await this.prisma.message.update({
        where: { id: messageId },
        data: updates,
      });
    } catch {
      this.logger.debug(
        { messageId, provider: owner.provider },
        'meta.webhook.status.message-not-found',
      );
      return;
    }

    if (!owner.instanceId) return;

    // Capture pricing if Meta sent it (only on terminal states like sent/delivered)
    if (status.pricing && owner.provider === ProviderType.META_WHATSAPP_CLOUD) {
      await this.pricing.record({
        tenantId: owner.tenantId,
        instanceId: owner.instanceId,
        provider: owner.provider,
        externalMessageId: status.providerMessageId,
        category: status.pricing.category,
        billable: status.pricing.billable,
        currency: status.pricing.currency,
        occurredAt: status.timestamp,
      });
    }

    const eventType = this.mapEventType(status.status);
    if (eventType) {
      await this.dispatch.dispatchEvent(owner.instanceId, owner.tenantId, eventType, {
        message_id: messageId,
        provider: owner.provider,
        status: status.status,
        recipient_id: status.recipientId,
        timestamp: status.timestamp.toISOString(),
        error_code: status.errorCode,
        error_reason: status.errorReason,
        pricing: status.pricing,
      });
    }
  }

  private buildContent(inbound: InboundMessage): Prisma.InputJsonValue {
    const content: Record<string, unknown> = {
      type: inbound.type,
    };
    if (inbound.text) content.text = inbound.text;
    if (inbound.media) content.media = inbound.media;
    if (inbound.location) content.location = inbound.location;
    if (inbound.reaction) content.reaction = inbound.reaction;
    if (inbound.interactive) content.interactive = inbound.interactive;
    if (inbound.replyTo) content.reply_to = inbound.replyTo;
    return content as Prisma.InputJsonValue;
  }

  private mapStatus(status: InboundStatusUpdate['status']) {
    switch (status) {
      case 'SENT':
        return 'SENT';
      case 'DELIVERED':
        return 'DELIVERED';
      case 'READ':
        return 'READ';
      case 'FAILED':
        return 'FAILED';
      default:
        return 'SENT';
    }
  }

  private mapEventType(status: InboundStatusUpdate['status']): WebhookEvent | null {
    switch (status) {
      case 'SENT':
        return WebhookEvent.MESSAGE_SENT;
      case 'DELIVERED':
        return WebhookEvent.MESSAGE_DELIVERED;
      case 'READ':
        return WebhookEvent.MESSAGE_READ;
      case 'FAILED':
        return WebhookEvent.MESSAGE_DELETED;
      default:
        return null;
    }
  }

  private async logRawEvent(
    tenantId: string | null,
    provider: ProviderType,
    eventType: string,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
    error: string | null,
    externalId?: string,
  ): Promise<void> {
    const payloadJson: Prisma.InputJsonValue = JSON.parse(rawBody.toString('utf8'));
    const headersJson: Prisma.InputJsonValue = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : String(v ?? '')]),
    );
    try {
      await this.prisma.inboundWebhookEvent.create({
        data: {
          tenantId: tenantId ?? undefined,
          provider: provider as unknown as $Enums.ProviderType,
          eventType,
          externalId,
          headers: headersJson,
          rawPayload: payloadJson,
          status: error ? 'DISCARDED' : 'PROCESSED',
          error,
          processedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error({ err: (err as Error).message }, 'meta.webhook.raw-log-failed');
    }
  }
}

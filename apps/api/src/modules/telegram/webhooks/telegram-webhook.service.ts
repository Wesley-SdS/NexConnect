import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  InboundMessage,
  ProviderType,
  TelegramCredentials,
  WebhookEvent,
} from '@nexconnect/core';
import { ProviderMetricsService } from '@nexconnect/shared';
import { PrismaService } from '@nexconnect/database';
import { $Enums, Prisma } from '@prisma/client';
import {
  CREDENTIAL_RESOLVER,
  CredentialResolver,
} from '../../providers/credential.resolver';
import { ProviderMediaIngestionService } from '../../providers/provider-media-ingestion.service';
import { WebhookDispatchService } from '../../webhooks/webhook-dispatch.service';
import { TelegramInboundMapper } from '../telegram-inbound.mapper';
import { TelegramUpdate } from '../types/telegram.types';

@Injectable()
export class TelegramWebhookService {
  private readonly logger = new Logger(TelegramWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: TelegramInboundMapper,
    private readonly dispatch: WebhookDispatchService,
    private readonly metrics: ProviderMetricsService,
    private readonly mediaIngestion: ProviderMediaIngestionService,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  async handleUpdate(
    credentialId: string,
    update: TelegramUpdate,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ accepted: number }> {
    const data = (await this.credentials.resolve(credentialId)) as TelegramCredentials;
    const credential = await this.prisma.providerCredential.findUnique({
      where: { id: credentialId },
      select: { id: true, tenantId: true, instanceId: true },
    });
    if (!credential) {
      await this.logRaw(null, credentialId, update, rawBody, headers, 'unknown_credential');
      this.metrics.recordWebhook(ProviderType.TELEGRAM, 'update', 'discarded');
      return { accepted: 0 };
    }

    const { messages } = this.mapper.mapUpdate(update, data.botUsername);
    let accepted = 0;
    for (const inbound of messages) {
      await this.persistInbound(credential, inbound);
      accepted++;
    }

    await this.logRaw(credential.tenantId, credentialId, update, rawBody, headers, null, String(update.update_id));
    this.metrics.recordWebhook(ProviderType.TELEGRAM, 'update', accepted > 0 ? 'processed' : 'discarded');
    return { accepted };
  }

  private async persistInbound(
    owner: { id: string; tenantId: string; instanceId: string | null },
    inbound: InboundMessage,
  ): Promise<void> {
    if (!owner.instanceId) {
      this.logger.warn(
        { credentialId: owner.id, providerMessageId: inbound.providerMessageId },
        'telegram.webhook.inbound.no-instance',
      );
      return;
    }

    const provider = ProviderType.TELEGRAM as unknown as $Enums.ProviderType;
    const internalId = `tg-${owner.instanceId}-${inbound.providerMessageId}`;

    const message = await this.prisma.message.upsert({
      where: { waMessageId: internalId },
      create: {
        id: internalId,
        instanceId: owner.instanceId,
        tenantId: owner.tenantId,
        waMessageId: internalId,
        provider,
        externalId: inbound.providerMessageId,
        fromAddress: inbound.fromAddress,
        toAddress: inbound.toAddress,
        direction: 'INBOUND',
        type: inbound.type as unknown as $Enums.MessageType,
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
          provider,
          externalMessageId: inbound.providerMessageId,
        },
      },
      create: {
        tenantId: owner.tenantId,
        instanceId: owner.instanceId,
        provider,
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
        provider: ProviderType.TELEGRAM,
        from: inbound.fromAddress,
        to: inbound.toAddress,
        type: inbound.type,
        content: message.content,
        timestamp: inbound.timestamp.toISOString(),
        contact: inbound.contact,
      },
    );

    if (inbound.media?.providerMediaId) {
      void this.mediaIngestion.ingest({
        tenantId: owner.tenantId,
        instanceId: owner.instanceId,
        credentialId: owner.id,
        messageId: message.id,
        provider: ProviderType.TELEGRAM,
        providerMediaId: inbound.media.providerMediaId,
        mimeType: inbound.media.mimeType,
        caption: inbound.media.caption,
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

  private async logRaw(
    tenantId: string | null,
    credentialId: string,
    update: unknown,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
    error: string | null,
    externalId?: string,
  ): Promise<void> {
    try {
      await this.prisma.inboundWebhookEvent.create({
        data: {
          tenantId: tenantId ?? undefined,
          provider: ProviderType.TELEGRAM as unknown as $Enums.ProviderType,
          eventType: 'update',
          externalId,
          headers: this.normalizeHeaders(headers),
          rawPayload: update as Prisma.InputJsonValue,
          status: error ? 'DISCARDED' : 'PROCESSED',
          error,
          processedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(
        { err: (err as Error).message, credentialId },
        'telegram.webhook.raw-log-failed',
      );
    }
    void rawBody; // raw body is already serialized by Fastify
  }

  private normalizeHeaders(
    headers: Record<string, string | string[] | undefined>,
  ): Prisma.InputJsonValue {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      if (v === undefined) continue;
      out[k] = Array.isArray(v) ? v.join(',') : String(v);
    }
    return out as Prisma.InputJsonValue;
  }
}

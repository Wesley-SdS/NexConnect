import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  InboundMessage,
  ProviderType,
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
import { SlackInboundMapper } from '../slack-inbound.mapper';
import {
  SlackEventCallback,
  SlackInteractivityPayload,
  SlackSlashCommandPayload,
} from '../types/slack.types';

type Owner = { id: string; tenantId: string; instanceId: string | null };

@Injectable()
export class SlackWebhookService {
  private readonly logger = new Logger(SlackWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: SlackInboundMapper,
    private readonly dispatch: WebhookDispatchService,
    private readonly metrics: ProviderMetricsService,
    private readonly mediaIngestion: ProviderMediaIngestionService,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  async handleEvent(
    credentialId: string,
    envelope: SlackEventCallback,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ challenge?: string; ok: true }> {
    if (envelope.type === 'url_verification' && envelope.challenge) {
      this.metrics.recordWebhook(ProviderType.SLACK, 'url_verification', 'processed');
      return { ok: true, challenge: envelope.challenge };
    }

    const owner = await this.prisma.providerCredential.findUnique({
      where: { id: credentialId },
      select: { id: true, tenantId: true, instanceId: true },
    });
    if (!owner) {
      await this.logRaw(null, credentialId, envelope, headers, 'unknown_credential');
      this.metrics.recordWebhook(ProviderType.SLACK, envelope.event?.type ?? 'unknown', 'discarded');
      return { ok: true };
    }

    const inbound = this.mapper.fromEvent(envelope);
    if (inbound) await this.persistInbound(owner, inbound);

    await this.logRaw(owner.tenantId, credentialId, envelope, headers, null, envelope.event_id);
    this.metrics.recordWebhook(
      ProviderType.SLACK,
      envelope.event?.type ?? envelope.type,
      inbound ? 'processed' : 'discarded',
    );
    return { ok: true };
  }

  async handleInteractivity(
    credentialId: string,
    payload: SlackInteractivityPayload,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ ok: true }> {
    const owner = await this.prisma.providerCredential.findUnique({
      where: { id: credentialId },
      select: { id: true, tenantId: true, instanceId: true },
    });
    if (!owner) {
      await this.logRaw(null, credentialId, payload, headers, 'unknown_credential');
      this.metrics.recordWebhook(ProviderType.SLACK, payload.type, 'discarded');
      return { ok: true };
    }
    const inbound = this.mapper.fromInteractivity(payload);
    if (inbound) await this.persistInbound(owner, inbound);

    await this.logRaw(owner.tenantId, credentialId, payload, headers, null, payload.trigger_id);
    this.metrics.recordWebhook(
      ProviderType.SLACK,
      payload.type,
      inbound ? 'processed' : 'discarded',
    );
    return { ok: true };
  }

  async handleSlashCommand(
    credentialId: string,
    payload: SlackSlashCommandPayload,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ response_type: 'ephemeral'; text: string }> {
    const owner = await this.prisma.providerCredential.findUnique({
      where: { id: credentialId },
      select: { id: true, tenantId: true, instanceId: true },
    });
    if (owner) {
      const inbound = this.mapper.fromSlashCommand(payload);
      await this.persistInbound(owner, inbound);
      await this.logRaw(owner.tenantId, credentialId, payload, headers, null, payload.trigger_id);
    } else {
      await this.logRaw(null, credentialId, payload, headers, 'unknown_credential');
    }
    this.metrics.recordWebhook(ProviderType.SLACK, 'slash_command', 'processed');

    return {
      response_type: 'ephemeral',
      text: `:white_check_mark: NexConnect recebeu \`${payload.command}\`. Em breve respondemos por aqui.`,
    };
  }

  // ─── helpers ─────────────────────────────────────────

  private async persistInbound(owner: Owner, inbound: InboundMessage): Promise<void> {
    if (!owner.instanceId) {
      this.logger.warn(
        { credentialId: owner.id, providerMessageId: inbound.providerMessageId },
        'slack.webhook.inbound.no-instance',
      );
      return;
    }

    const provider = ProviderType.SLACK as unknown as $Enums.ProviderType;
    const internalId = `sl-${owner.instanceId}-${inbound.providerMessageId}`;

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
        provider: ProviderType.SLACK,
        from: inbound.fromAddress,
        to: inbound.toAddress,
        type: inbound.type,
        content: message.content,
        timestamp: inbound.timestamp.toISOString(),
        contact: inbound.contact,
      },
    );

    if (inbound.media?.url) {
      void this.mediaIngestion.ingest({
        tenantId: owner.tenantId,
        instanceId: owner.instanceId,
        credentialId: owner.id,
        messageId: message.id,
        provider: ProviderType.SLACK,
        mediaUrl: inbound.media.url,
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
      reaction: inbound.reaction,
      interactive: inbound.interactive,
      reply_to: inbound.replyTo,
    } as Prisma.InputJsonValue;
  }

  private async logRaw(
    tenantId: string | null,
    credentialId: string,
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
    error: string | null,
    externalId?: string,
  ): Promise<void> {
    try {
      await this.prisma.inboundWebhookEvent.create({
        data: {
          tenantId: tenantId ?? undefined,
          provider: ProviderType.SLACK as unknown as $Enums.ProviderType,
          eventType: (payload as { type?: string }).type ?? 'unknown',
          externalId,
          headers: this.normalizeHeaders(headers),
          rawPayload: payload as Prisma.InputJsonValue,
          status: error ? 'DISCARDED' : 'PROCESSED',
          error,
          processedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(
        { err: (err as Error).message, credentialId },
        'slack.webhook.raw-log-failed',
      );
    }
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

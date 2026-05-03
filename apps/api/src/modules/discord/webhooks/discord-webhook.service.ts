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
import { WebhookDispatchService } from '../../webhooks/webhook-dispatch.service';
import { DiscordInboundMapper } from '../discord-inbound.mapper';
import {
  DiscordInteraction,
  InteractionResponseType,
  InteractionType,
} from '../types/discord.types';

@Injectable()
export class DiscordWebhookService {
  private readonly logger = new Logger(DiscordWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: DiscordInboundMapper,
    private readonly dispatch: WebhookDispatchService,
    private readonly metrics: ProviderMetricsService,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  async handleInteraction(
    credentialId: string,
    interaction: DiscordInteraction,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ type: InteractionResponseType; data?: unknown }> {
    if (interaction.type === InteractionType.PING) {
      this.metrics.recordWebhook(ProviderType.DISCORD, 'PING', 'processed');
      return { type: InteractionResponseType.PONG };
    }

    const credential = await this.prisma.providerCredential.findUnique({
      where: { id: credentialId },
      select: { id: true, tenantId: true, instanceId: true },
    });
    if (!credential) {
      await this.logRaw(null, credentialId, interaction, headers, 'unknown_credential');
      this.metrics.recordWebhook(ProviderType.DISCORD, String(interaction.type), 'discarded');
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'NexConnect: credencial não encontrada.', flags: 64 },
      };
    }

    const inbound = this.mapper.fromInteraction(interaction);
    if (inbound) {
      await this.persistInbound(credential, inbound);
    }

    await this.logRaw(
      credential.tenantId,
      credentialId,
      interaction,
      headers,
      null,
      interaction.id,
    );
    this.metrics.recordWebhook(ProviderType.DISCORD, String(interaction.type), 'processed');

    // Defer the response — the consumer can respond out-of-band via the
    // interaction follow-up endpoint within 15 minutes.
    return { type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE };
    void rawBody; // raw bytes already persisted by Fastify hook
  }

  private async persistInbound(
    owner: { id: string; tenantId: string; instanceId: string | null },
    inbound: InboundMessage,
  ): Promise<void> {
    if (!owner.instanceId) {
      this.logger.warn(
        { credentialId: owner.id, providerMessageId: inbound.providerMessageId },
        'discord.webhook.inbound.no-instance',
      );
      return;
    }

    const provider = ProviderType.DISCORD as unknown as $Enums.ProviderType;
    const internalId = `dc-${owner.instanceId}-${inbound.providerMessageId}`;

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
        provider: ProviderType.DISCORD,
        from: inbound.fromAddress,
        to: inbound.toAddress,
        type: inbound.type,
        content: message.content,
        timestamp: inbound.timestamp.toISOString(),
        contact: inbound.contact,
      },
    );
  }

  private buildContent(inbound: InboundMessage): Prisma.InputJsonValue {
    return {
      type: inbound.type,
      text: inbound.text,
      media: inbound.media,
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
          provider: ProviderType.DISCORD as unknown as $Enums.ProviderType,
          eventType: 'interaction',
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
        'discord.webhook.raw-log-failed',
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

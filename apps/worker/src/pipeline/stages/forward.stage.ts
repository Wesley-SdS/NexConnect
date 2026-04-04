import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  IPipelineStage,
  MessageContext,
  WebhookEvent,
} from '@nexconnect/core';
import { CryptoUtil, UlidUtil } from '@nexconnect/shared';
import { PrismaService } from '@nexconnect/database';

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  instance_id: string;
  data: {
    message_id: string;
    from: string | null;
    phone: string | null;
    profile_name: string | null;
    message_type: string | undefined;
    text: string | undefined;
    media_url: string | undefined;
    transcription: string | undefined;
    is_group: boolean | undefined;
    tenant_id: string | null | undefined;
    buffered_messages_count: number | undefined;
  };
}

@Injectable()
export class WebhookForwardStage implements IPipelineStage {
  private readonly logger = new Logger(WebhookForwardStage.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('webhook-delivery')
    private readonly webhookQueue: Queue,
  ) {}

  async execute(context: MessageContext): Promise<MessageContext | null> {
    const payload = this.buildPayload(context);
    const webhookConfigs = await this.loadWebhookConfigs(
      context.instanceId,
    );

    if (webhookConfigs.length === 0) {
      this.logger.debug('No webhook configs found, skipping forward', {
        messageId: context.id,
        instanceId: context.instanceId,
      });
      return context;
    }

    const serializedPayload = JSON.stringify(payload);

    for (const config of webhookConfigs) {
      const signature = CryptoUtil.generateHmacSignature(
        serializedPayload,
        config.secret,
      );

      await this.webhookQueue.add(
        'deliver',
        {
          id: UlidUtil.generate(),
          url: config.url,
          payload: serializedPayload,
          signature,
          instanceId: context.instanceId,
          messageId: context.id,
          attempt: 0,
        },
        {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 200,
          removeOnFail: 1000,
        },
      );

      this.logger.debug('Webhook delivery enqueued', {
        messageId: context.id,
        webhookUrl: config.url,
      });
    }

    return context;
  }

  private buildPayload(context: MessageContext): WebhookPayload {
    return {
      event: WebhookEvent.MESSAGE_RECEIVED,
      timestamp: new Date().toISOString(),
      instance_id: context.instanceId,
      data: {
        message_id: context.id,
        from: context.rawMessage.key.remoteJid ?? null,
        phone: context.normalizedPhone ?? null,
        profile_name: context.profileName ?? null,
        message_type: context.messageType,
        text: context.bufferedText,
        media_url: context.mediaUrl,
        transcription: context.transcription,
        is_group: context.isGroup,
        tenant_id: context.tenantId,
        buffered_messages_count: context.bufferedMessagesCount,
      },
    };
  }

  private async loadWebhookConfigs(
    instanceId: string,
  ): Promise<Array<{ url: string; secret: string }>> {
    try {
      const configs = await this.prisma.$queryRaw<
        Array<{ url: string; secret: string }>
      >`
        SELECT url, secret FROM webhook_configs
        WHERE instance_id = ${instanceId} AND enabled = true
      `;
      return configs ?? [];
    } catch (error) {
      this.logger.error('Failed to load webhook configs', {
        instanceId,
        error: (error as Error).message,
      });
      return [];
    }
  }
}

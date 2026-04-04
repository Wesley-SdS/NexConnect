import { Injectable, Logger } from '@nestjs/common';
import { IPipelineStage, MessageContext } from '@nexconnect/core';
import { PhoneUtil } from '@nexconnect/shared';
import { PrismaService } from '@nexconnect/database';

@Injectable()
export class MessageEnrichmentStage implements IPipelineStage {
  private readonly logger = new Logger(MessageEnrichmentStage.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(context: MessageContext): Promise<MessageContext | null> {
    const remoteJid = context.rawMessage.key.remoteJid;

    if (!remoteJid) {
      this.logger.warn('No remoteJid in message, skipping enrichment', {
        messageId: context.id,
      });
      return context;
    }

    const isGroup = remoteJid.endsWith('@g.us');
    const phoneNumber = this.extractPhone(remoteJid);
    const normalizedPhone = phoneNumber
      ? PhoneUtil.normalize(phoneNumber)
      : null;

    const profileName =
      context.rawMessage.pushName ?? null;

    const tenantId = await this.resolveTenantId(context.instanceId);

    this.logger.debug('Message enriched', {
      messageId: context.id,
      isGroup,
      normalizedPhone,
      profileName,
      tenantId,
    });

    return {
      ...context,
      isGroup,
      normalizedPhone,
      profileName,
      tenantId,
      bufferedMessagesCount: context.bufferedMessagesCount ?? 1,
    };
  }

  private extractPhone(jid: string): string | null {
    const match = jid.match(/^(\d+)@/);
    return match ? match[1] : null;
  }

  private async resolveTenantId(
    instanceId: string,
  ): Promise<string | null> {
    try {
      const instance = await this.prisma.$queryRaw<
        Array<{ tenant_id: string }>
      >`
        SELECT tenant_id FROM instances WHERE id = ${instanceId} LIMIT 1
      `;

      return instance?.[0]?.tenant_id ?? null;
    } catch (error) {
      this.logger.error('Failed to resolve tenant_id', {
        instanceId,
        error: (error as Error).message,
      });
      return null;
    }
  }
}

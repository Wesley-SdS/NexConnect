import { Injectable, Logger } from '@nestjs/common';
import { IPipelineStage, MessageContext } from '@nexconnect/core';
import { RedisService } from '@nexconnect/redis';
import { BaileysConnectionService } from '../../connection/baileys-connection.service';

@Injectable()
export class PresenceUpdateStage implements IPipelineStage {
  private readonly logger = new Logger(PresenceUpdateStage.name);

  constructor(
    private readonly baileysConnection: BaileysConnectionService,
    private readonly redis: RedisService,
  ) {}

  async execute(context: MessageContext): Promise<MessageContext | null> {
    const remoteJid = context.rawMessage.key.remoteJid;
    if (!remoteJid) return context;

    const settings = (context as any).instanceSettings?.autoPresence;
    if (!settings?.enabled) return context;

    try {
      if (!this.baileysConnection.isConnected(context.instanceId)) {
        return context;
      }

      const presenceStatus =
        settings.status === 'recording' ? 'recording' : 'composing';

      await this.baileysConnection.sendPresenceUpdate(
        context.instanceId,
        remoteJid,
        presenceStatus,
      );

      if (settings.strategy === 'until_next_message') {
        // Marca presence como ativo no Redis — será limpo quando mensagem for enviada
        const presenceKey = `presence:active:${context.instanceId}:${remoteJid}`;
        const maxDuration = settings.maxDuration ?? 600; // 10 min default
        await this.redis.set(presenceKey, presenceStatus, maxDuration);
      }

      this.logger.debug(
        {
          messageId: context.id,
          instanceId: context.instanceId,
          remoteJid,
          strategy: settings.strategy,
          status: presenceStatus,
        },
        'presence.sent',
      );
    } catch (error) {
      this.logger.warn(
        {
          messageId: context.id,
          error: (error as Error).message,
        },
        'presence.send.failed',
      );
    }

    return context;
  }
}

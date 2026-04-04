import { Injectable, Logger } from '@nestjs/common';
import { IPipelineStage, MessageContext } from '@nexconnect/core';
import { BaileysConnectionService } from '../../connection/baileys-connection.service';

@Injectable()
export class PresenceUpdateStage implements IPipelineStage {
  private readonly logger = new Logger(PresenceUpdateStage.name);

  constructor(
    private readonly baileysConnection: BaileysConnectionService,
  ) {}

  async execute(context: MessageContext): Promise<MessageContext | null> {
    const remoteJid = context.rawMessage.key.remoteJid;

    if (!remoteJid) {
      return context;
    }

    try {
      if (!this.baileysConnection.isConnected(context.instanceId)) {
        this.logger.debug('Instance not connected, skipping presence', {
          messageId: context.id,
          instanceId: context.instanceId,
        });
        return context;
      }

      await this.baileysConnection.sendMessage(
        context.instanceId,
        remoteJid,
        { presenceUpdate: 'composing' } as any,
      );

      this.logger.debug('Composing presence sent', {
        messageId: context.id,
        instanceId: context.instanceId,
        remoteJid,
      });
    } catch (error) {
      this.logger.warn('Failed to send presence update', {
        messageId: context.id,
        error: (error as Error).message,
      });
    }

    return context;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { IPipelineStage, MessageContext, MessageType } from '@nexconnect/core';

@Injectable()
export class MessageClassificationStage implements IPipelineStage {
  private readonly logger = new Logger(MessageClassificationStage.name);

  async execute(context: MessageContext): Promise<MessageContext | null> {
    const rawMessage = context.rawMessage.message;

    if (!rawMessage) {
      this.logger.warn('Message has no content, skipping', {
        messageId: context.id,
      });
      return null;
    }

    const messageType = this.classifyMessage(rawMessage);

    this.logger.debug('Message classified', {
      messageId: context.id,
      messageType,
    });

    return {
      ...context,
      messageType,
    };
  }

  private classifyMessage(message: Record<string, unknown>): MessageType {
    // Status reply: extendedTextMessage com contextInfo de broadcast (deve vir antes do check de TEXT)
    if ((message as any).extendedTextMessage?.contextInfo?.remoteJid?.endsWith('@broadcast')) {
      return MessageType.STATUS_REPLY;
    }

    if (message.conversation || message.extendedTextMessage) {
      return MessageType.TEXT;
    }

    if (message.imageMessage) {
      return MessageType.IMAGE;
    }

    if (message.videoMessage) {
      return MessageType.VIDEO;
    }

    if (message.audioMessage) {
      return MessageType.AUDIO;
    }

    if (message.documentMessage) {
      return MessageType.DOCUMENT;
    }

    if (message.stickerMessage) {
      return MessageType.STICKER;
    }

    if (message.locationMessage || message.liveLocationMessage) {
      return MessageType.LOCATION;
    }

    if (message.contactMessage || message.contactsArrayMessage) {
      return MessageType.VCARD;
    }

    if (message.buttonsResponseMessage) {
      return MessageType.BUTTON_REPLY;
    }

    if (message.listResponseMessage) {
      return MessageType.LIST_REPLY;
    }

    if (message.reactionMessage) {
      return MessageType.REACTION;
    }

    if (message.pollCreationMessage || message.pollUpdateMessage) {
      return MessageType.POLL;
    }

    return MessageType.UNKNOWN;
  }
}

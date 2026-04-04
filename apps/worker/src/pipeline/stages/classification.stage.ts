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
      return MessageType.CONTACT;
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

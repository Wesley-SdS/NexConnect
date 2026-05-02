import { Injectable } from '@nestjs/common';
import {
  MessageType,
  OutboundMessage,
  ProviderType,
  ProviderUnsupportedOperationError,
  ProviderValidationError,
} from '@nexconnect/core';
import { InstagramSendMessageInput } from './instagram.client';

@Injectable()
export class InstagramMapper {
  toClientInput(message: OutboundMessage): InstagramSendMessageInput {
    if (!message.to) {
      throw new ProviderValidationError(ProviderType.META_INSTAGRAM, 'recipientId (to) is required');
    }

    switch (message.type) {
      case MessageType.TEXT:
        return { recipientId: message.to, messageText: message.text };
      case MessageType.IMAGE:
        return this.mapAttachment(message.to, message.media?.url, 'image');
      case MessageType.VIDEO:
        return this.mapAttachment(message.to, message.media?.url, 'video');
      case MessageType.AUDIO:
        return this.mapAttachment(message.to, message.media?.url, 'audio');
      case MessageType.DOCUMENT:
        return this.mapAttachment(message.to, message.media?.url, 'file');
      case MessageType.BUTTON_REPLY:
        return this.mapQuickReplies(message);
      default:
        throw new ProviderUnsupportedOperationError(
          ProviderType.META_INSTAGRAM,
          `send:${message.type}`,
        );
    }
  }

  private mapAttachment(
    recipientId: string,
    url: string | undefined,
    type: 'image' | 'video' | 'audio' | 'file',
  ): InstagramSendMessageInput {
    if (!url) {
      throw new ProviderValidationError(
        ProviderType.META_INSTAGRAM,
        `Attachment URL is required for ${type} messages`,
      );
    }
    return { recipientId, attachmentUrl: url, attachmentType: type };
  }

  private mapQuickReplies(message: Extract<OutboundMessage, { type: MessageType.BUTTON_REPLY }>): InstagramSendMessageInput {
    return {
      recipientId: message.to,
      messageText: message.body,
      quickReplies: message.buttons.map((b) => ({ title: b.title, payload: b.id })),
    };
  }
}

import { Injectable } from '@nestjs/common';
import {
  InboundMessage,
  InboundStatusKind,
  InboundStatusUpdate,
  MessageType,
  ProviderType,
} from '@nexconnect/core';
import { GraphInstagramMessagingEntry } from '../types/graph-api.types';

@Injectable()
export class MessengerInboundMapper {
  mapMessaging(
    messaging: GraphInstagramMessagingEntry['messaging'],
    pageId: string,
  ): { messages: InboundMessage[]; statuses: InboundStatusUpdate[] } {
    const messages: InboundMessage[] = [];
    const statuses: InboundStatusUpdate[] = [];

    for (const event of messaging) {
      if (event.message && !event.message.is_echo) {
        const attachment = event.message.attachments?.[0];
        messages.push({
          provider: ProviderType.META_MESSENGER,
          providerMessageId: event.message.mid,
          fromAddress: event.sender.id,
          toAddress: pageId,
          contact: { messengerId: event.sender.id },
          timestamp: new Date(event.timestamp),
          type: this.mapType(attachment?.type),
          text: event.message.text,
          media: attachment?.payload.url
            ? { url: attachment.payload.url, mimeType: 'application/octet-stream' }
            : undefined,
          replyTo: event.message.reply_to?.mid,
        });
      } else if (event.read?.mid) {
        statuses.push({
          provider: ProviderType.META_MESSENGER,
          providerMessageId: event.read.mid,
          recipientId: event.sender.id,
          status: InboundStatusKind.READ,
          timestamp: new Date(event.timestamp),
        });
      }
    }

    return { messages, statuses };
  }

  private mapType(type: string | undefined): MessageType {
    switch (type) {
      case 'image':
        return MessageType.IMAGE;
      case 'video':
        return MessageType.VIDEO;
      case 'audio':
        return MessageType.AUDIO;
      case 'file':
        return MessageType.DOCUMENT;
      default:
        return MessageType.TEXT;
    }
  }
}

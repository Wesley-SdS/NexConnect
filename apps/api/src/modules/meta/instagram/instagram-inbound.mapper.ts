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
export class InstagramInboundMapper {
  mapMessaging(
    messaging: GraphInstagramMessagingEntry['messaging'],
    pageId: string,
  ): { messages: InboundMessage[]; statuses: InboundStatusUpdate[] } {
    const messages: InboundMessage[] = [];
    const statuses: InboundStatusUpdate[] = [];

    for (const event of messaging) {
      if (event.message && !event.message.is_echo) {
        messages.push(this.toInboundMessage(event, pageId));
      } else if (event.read?.mid) {
        statuses.push({
          provider: ProviderType.META_INSTAGRAM,
          providerMessageId: event.read.mid,
          recipientId: event.sender.id,
          status: InboundStatusKind.READ,
          timestamp: new Date(event.timestamp),
        });
      } else if (event.message?.is_echo) {
        statuses.push({
          provider: ProviderType.META_INSTAGRAM,
          providerMessageId: event.message.mid,
          recipientId: event.recipient.id,
          status: InboundStatusKind.SENT,
          timestamp: new Date(event.timestamp),
        });
      }
    }

    return { messages, statuses };
  }

  private toInboundMessage(
    event: GraphInstagramMessagingEntry['messaging'][number],
    pageId: string,
  ): InboundMessage {
    const attachment = event.message?.attachments?.[0];
    const isStoryMention = attachment?.type === 'story_mention';
    const isStoryReply = Boolean(event.message?.reply_to?.story);
    const type = isStoryMention || isStoryReply ? MessageType.STORY_REPLY : this.mapType(attachment?.type);

    return {
      provider: ProviderType.META_INSTAGRAM,
      providerMessageId: event.message!.mid,
      fromAddress: event.sender.id,
      toAddress: pageId,
      contact: { instagramId: event.sender.id },
      timestamp: new Date(event.timestamp),
      type,
      text: event.message?.text,
      media: attachment?.payload.url
        ? { url: attachment.payload.url, mimeType: this.guessMime(attachment.type) }
        : undefined,
      replyTo: event.message?.reply_to?.mid,
      metadata: {
        postbackPayload: event.postback?.payload,
        storyMention: isStoryMention,
        storyId: event.message?.reply_to?.story?.id,
        storyUrl: event.message?.reply_to?.story?.url,
        attachmentType: attachment?.type,
      },
    };
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
      case 'story_mention':
      case 'template':
        return MessageType.UNKNOWN;
      default:
        return MessageType.TEXT;
    }
  }

  private guessMime(type: string | undefined): string {
    switch (type) {
      case 'image':
        return 'image/jpeg';
      case 'video':
        return 'video/mp4';
      case 'audio':
        return 'audio/mpeg';
      case 'file':
        return 'application/octet-stream';
      default:
        return 'application/octet-stream';
    }
  }
}

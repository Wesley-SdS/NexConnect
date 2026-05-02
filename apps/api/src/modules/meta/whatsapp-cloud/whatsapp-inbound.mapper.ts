import { Injectable } from '@nestjs/common';
import {
  InboundMessage,
  InboundStatusKind,
  InboundStatusUpdate,
  MessageType,
  ProviderType,
} from '@nexconnect/core';
import {
  GraphIncomingMedia,
  GraphIncomingMessage,
  GraphMessageStatusEntry,
  GraphWebhookContact,
  GraphWhatsAppChangeValue,
} from '../types/graph-api.types';

@Injectable()
export class WhatsAppInboundMapper {
  mapValue(value: GraphWhatsAppChangeValue): {
    messages: InboundMessage[];
    statuses: InboundStatusUpdate[];
    phoneNumberId: string;
  } {
    const phoneNumberId = value.metadata.phone_number_id;
    const contactIndex = new Map<string, GraphWebhookContact>();
    for (const c of value.contacts ?? []) {
      contactIndex.set(c.wa_id, c);
    }

    const messages = (value.messages ?? []).map((m) =>
      this.mapMessage(m, phoneNumberId, contactIndex.get(m.from)),
    );
    const statuses = (value.statuses ?? []).map((s) => this.mapStatus(s));

    return { messages, statuses, phoneNumberId };
  }

  private mapMessage(
    m: GraphIncomingMessage,
    phoneNumberId: string,
    contact: GraphWebhookContact | undefined,
  ): InboundMessage {
    const base: InboundMessage = {
      provider: ProviderType.META_WHATSAPP_CLOUD,
      providerMessageId: m.id,
      fromAddress: m.from,
      toAddress: phoneNumberId,
      contact: {
        profileName: contact?.profile?.name,
        waId: contact?.wa_id ?? m.from,
        phone: m.from,
      },
      timestamp: new Date(Number(m.timestamp) * 1000),
      type: this.mapType(m.type),
      replyTo: m.context?.id,
      metadata: { rawType: m.type },
    };

    switch (m.type) {
      case 'text':
        base.text = m.text?.body;
        break;
      case 'image':
      case 'video':
      case 'audio':
      case 'document':
      case 'sticker':
        base.media = this.mapMedia(
          (m[m.type as 'image' | 'video' | 'audio' | 'document' | 'sticker'] as GraphIncomingMedia) ?? undefined,
        );
        break;
      case 'location':
        if (m.location) base.location = m.location;
        break;
      case 'reaction':
        if (m.reaction) {
          base.reaction = { messageId: m.reaction.message_id, emoji: m.reaction.emoji };
        }
        break;
      case 'interactive':
        if (m.interactive?.type === 'button_reply' && m.interactive.button_reply) {
          base.interactive = {
            kind: 'button_reply',
            id: m.interactive.button_reply.id,
            title: m.interactive.button_reply.title,
          };
        } else if (m.interactive?.type === 'list_reply' && m.interactive.list_reply) {
          base.interactive = {
            kind: 'list_reply',
            id: m.interactive.list_reply.id,
            title: m.interactive.list_reply.title,
            description: m.interactive.list_reply.description,
          };
        }
        break;
      case 'button':
        if (m.button) {
          base.interactive = {
            kind: 'button_reply',
            id: m.button.payload,
            title: m.button.text,
          };
        }
        break;
    }
    return base;
  }

  private mapMedia(media: GraphIncomingMedia | undefined): InboundMessage['media'] | undefined {
    if (!media) return undefined;
    return {
      providerMediaId: media.id,
      mimeType: media.mime_type,
      sha256: media.sha256,
      filename: media.filename,
      caption: media.caption,
    };
  }

  private mapStatus(s: GraphMessageStatusEntry): InboundStatusUpdate {
    const kind = this.mapStatusKind(s.status);
    const first = s.errors?.[0];
    return {
      provider: ProviderType.META_WHATSAPP_CLOUD,
      providerMessageId: s.id,
      recipientId: s.recipient_id,
      status: kind,
      timestamp: new Date(Number(s.timestamp) * 1000),
      errorCode: first ? String(first.code) : undefined,
      errorReason: first ? first.title : undefined,
      pricing: s.pricing
        ? {
            category: s.pricing.category,
            billable: s.pricing.billable,
          }
        : undefined,
    };
  }

  private mapStatusKind(status: GraphMessageStatusEntry['status']): InboundStatusKind {
    switch (status) {
      case 'sent':
        return InboundStatusKind.SENT;
      case 'delivered':
        return InboundStatusKind.DELIVERED;
      case 'read':
        return InboundStatusKind.READ;
      case 'failed':
      case 'deleted':
        return InboundStatusKind.FAILED;
      default:
        return InboundStatusKind.SENT;
    }
  }

  private mapType(type: string): MessageType {
    switch (type) {
      case 'text':
        return MessageType.TEXT;
      case 'image':
        return MessageType.IMAGE;
      case 'video':
        return MessageType.VIDEO;
      case 'audio':
        return MessageType.AUDIO;
      case 'document':
        return MessageType.DOCUMENT;
      case 'sticker':
        return MessageType.STICKER;
      case 'location':
        return MessageType.LOCATION;
      case 'contacts':
        return MessageType.VCARD;
      case 'reaction':
        return MessageType.REACTION;
      case 'interactive':
      case 'button':
        return MessageType.BUTTON_REPLY;
      default:
        return MessageType.UNKNOWN;
    }
  }
}

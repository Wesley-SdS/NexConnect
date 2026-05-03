import { Injectable } from '@nestjs/common';
import {
  InboundMessage,
  InboundStatusKind,
  InboundStatusUpdate,
  MessageType,
  ProviderType,
} from '@nexconnect/core';
import {
  TelegramCallbackQuery,
  TelegramMessage,
  TelegramUpdate,
} from './types/telegram.types';

export interface MappedTelegramUpdate {
  messages: InboundMessage[];
  statuses: InboundStatusUpdate[];
}

/**
 * Translates Telegram Update payloads into the normalized InboundMessage
 * / InboundStatusUpdate domain objects consumed by NexConnect's webhook
 * dispatcher. Handles message, edited_message, channel_post, callback_query,
 * poll, poll_answer, my_chat_member.
 */
@Injectable()
export class TelegramInboundMapper {
  mapUpdate(update: TelegramUpdate, botUsername?: string): MappedTelegramUpdate {
    const messages: InboundMessage[] = [];
    const statuses: InboundStatusUpdate[] = [];

    if (update.message) messages.push(this.mapMessage(update.message, botUsername));
    if (update.edited_message) messages.push({ ...this.mapMessage(update.edited_message, botUsername), metadata: { ...this.mapMessage(update.edited_message, botUsername).metadata, edited: true } });
    if (update.channel_post) messages.push(this.mapMessage(update.channel_post, botUsername));
    if (update.callback_query) messages.push(this.mapCallbackQuery(update.callback_query));

    if (update.poll_answer) {
      const pa = update.poll_answer;
      messages.push({
        provider: ProviderType.TELEGRAM,
        providerMessageId: `poll-answer:${pa.poll_id}:${pa.user.id}`,
        fromAddress: String(pa.user.id),
        toAddress: '',
        contact: { profileName: pa.user.first_name, phone: String(pa.user.id) },
        timestamp: new Date(),
        type: MessageType.POLL_VOTE,
        text: undefined,
        metadata: { pollId: pa.poll_id, optionIds: pa.option_ids, language: pa.user.language_code },
      });
    }

    return { messages, statuses };
  }

  private mapMessage(m: TelegramMessage, botUsername?: string): InboundMessage {
    const type = this.classify(m, botUsername);
    return {
      provider: ProviderType.TELEGRAM,
      providerMessageId: String(m.message_id),
      fromAddress: m.from ? String(m.from.id) : String(m.chat.id),
      toAddress: String(m.chat.id),
      contact: {
        profileName: m.from
          ? [m.from.first_name, m.from.last_name].filter(Boolean).join(' ')
          : m.chat.title,
        phone: m.contact?.phone_number,
      },
      timestamp: new Date(m.date * 1000),
      type,
      text: m.text ?? m.caption,
      replyTo: m.reply_to_message ? String(m.reply_to_message.message_id) : undefined,
      media: this.extractMedia(m),
      location: m.location
        ? { latitude: m.location.latitude, longitude: m.location.longitude }
        : undefined,
      metadata: {
        chatType: m.chat.type,
        threadId: m.message_thread_id,
        languageCode: m.from?.language_code,
        username: m.from?.username,
        entities: m.entities,
      },
    };
  }

  private mapCallbackQuery(q: TelegramCallbackQuery): InboundMessage {
    return {
      provider: ProviderType.TELEGRAM,
      providerMessageId: q.id,
      fromAddress: String(q.from.id),
      toAddress: q.message ? String(q.message.chat.id) : '',
      contact: {
        profileName: [q.from.first_name, q.from.last_name].filter(Boolean).join(' '),
      },
      timestamp: new Date(),
      type: MessageType.BUTTON_REPLY,
      replyTo: q.message ? String(q.message.message_id) : undefined,
      interactive: q.data ? { kind: 'button_reply', id: q.data, title: q.data } : undefined,
      metadata: { callbackQueryId: q.id, chatInstance: q.chat_instance },
    };
  }

  private extractMedia(m: TelegramMessage): InboundMessage['media'] {
    if (m.photo?.length) {
      const largest = m.photo[m.photo.length - 1];
      return { providerMediaId: largest.file_id, mimeType: 'image/jpeg', sizeBytes: largest.file_size };
    }
    if (m.video) return { providerMediaId: m.video.file_id, mimeType: m.video.mime_type ?? 'video/mp4' };
    if (m.audio) return { providerMediaId: m.audio.file_id, mimeType: m.audio.mime_type ?? 'audio/mpeg' };
    if (m.voice) return { providerMediaId: m.voice.file_id, mimeType: m.voice.mime_type ?? 'audio/ogg' };
    if (m.document) return { providerMediaId: m.document.file_id, mimeType: m.document.mime_type ?? 'application/octet-stream', filename: m.document.file_name };
    if (m.sticker) return { providerMediaId: m.sticker.file_id, mimeType: 'image/webp' };
    return undefined;
  }

  private classify(m: TelegramMessage, botUsername?: string): MessageType {
    if (m.text?.startsWith('/')) {
      const command = m.text.split(/\s/)[0].split('@')[0].slice(1);
      const target = m.text.split(/\s/)[0].split('@')[1];
      if (!botUsername || !target || target.toLowerCase() === botUsername.toLowerCase()) {
        return command ? MessageType.SLASH_COMMAND : MessageType.TEXT;
      }
    }
    if (m.text) return MessageType.TEXT;
    if (m.photo?.length) return MessageType.IMAGE;
    if (m.video) return MessageType.VIDEO;
    if (m.audio) return MessageType.AUDIO;
    if (m.voice) return MessageType.AUDIO;
    if (m.document) return MessageType.DOCUMENT;
    if (m.sticker) return MessageType.STICKER;
    if (m.location) return MessageType.LOCATION;
    if (m.contact) return MessageType.VCARD;
    if (m.poll) return MessageType.POLL;
    if (m.dice) return MessageType.DICE;
    return MessageType.UNKNOWN;
  }
}

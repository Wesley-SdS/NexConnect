import { Injectable } from '@nestjs/common';
import {
  CardOutboundMessage,
  ContactsOutboundMessage,
  DiceOutboundMessage,
  DocumentOutboundMessage,
  ImageOutboundMessage,
  InteractiveButtonsMessage,
  InteractiveListMessage,
  LocationOutboundMessage,
  MessageType,
  OutboundMessage,
  PollOutboundMessage,
  ProviderType,
  ProviderUnsupportedOperationError,
  ProviderValidationError,
  StickerOutboundMessage,
  TextOutboundMessage,
  VideoOutboundMessage,
  AudioOutboundMessage,
  ReactionOutboundMessage,
} from '@nexconnect/core';
import { TelegramInlineKeyboardButton, TelegramReplyMarkup } from './types/telegram.types';

export interface TelegramSendCall {
  method:
    | 'sendMessage'
    | 'sendPhoto'
    | 'sendVideo'
    | 'sendAudio'
    | 'sendVoice'
    | 'sendDocument'
    | 'sendSticker'
    | 'sendLocation'
    | 'sendContact'
    | 'sendPoll'
    | 'sendDice';
  params: Record<string, unknown>;
}

/**
 * Translates the normalized OutboundMessage into one of Telegram's
 * sendXxx Bot API methods + the corresponding params payload.
 *
 * Why a discriminated method/params return: the Telegram API has one
 * URL per message kind, unlike Meta/Twilio which collapse everything
 * into a single endpoint. This keeps the provider thin.
 */
@Injectable()
export class TelegramMapper {
  toSendCall(chatId: number | string, message: OutboundMessage): TelegramSendCall {
    const replyMarkup = this.buildReplyMarkup(message);
    const replyParameters = message.context?.messageId
      ? { message_id: Number(message.context.messageId) }
      : undefined;

    switch (message.type) {
      case MessageType.TEXT:
        return this.mapText(chatId, message, replyMarkup, replyParameters);
      case MessageType.IMAGE:
        return this.mapPhoto(chatId, message, replyMarkup, replyParameters);
      case MessageType.VIDEO:
        return this.mapVideo(chatId, message, replyMarkup, replyParameters);
      case MessageType.AUDIO:
        return this.mapAudio(chatId, message, replyMarkup, replyParameters);
      case MessageType.DOCUMENT:
        return this.mapDocument(chatId, message, replyMarkup, replyParameters);
      case MessageType.STICKER:
        return this.mapSticker(chatId, message, replyParameters);
      case MessageType.LOCATION:
        return this.mapLocation(chatId, message, replyParameters);
      case MessageType.VCARD:
        return this.mapContact(chatId, message);
      case MessageType.POLL:
        return this.mapPoll(chatId, message);
      case MessageType.DICE:
        return this.mapDice(chatId, message);
      case MessageType.BUTTON_REPLY:
      case MessageType.LIST_REPLY:
      case MessageType.CARD:
        return this.mapInteractiveAsText(chatId, message, replyMarkup, replyParameters);
      case MessageType.REACTION:
        throw new ProviderUnsupportedOperationError(
          ProviderType.TELEGRAM,
          'send:REACTION (use Provider.addReaction for setMessageReaction)',
        );
      default:
        throw new ProviderUnsupportedOperationError(
          ProviderType.TELEGRAM,
          `send:${(message as { type: string }).type}`,
        );
    }
  }

  // ─── reactions ────────────────────────────────────────

  toReactionParams(chatId: number | string, externalMessageId: string, emoji: string) {
    const messageId = Number(externalMessageId);
    if (!Number.isFinite(messageId)) {
      throw new ProviderValidationError(
        ProviderType.TELEGRAM,
        `Invalid externalMessageId for Telegram reaction: ${externalMessageId}`,
      );
    }
    return {
      chat_id: chatId,
      message_id: messageId,
      reaction: [{ type: 'emoji' as const, emoji }],
    };
  }

  // ─── private mappers per type ────────────────────────

  private mapText(
    chatId: number | string,
    m: TextOutboundMessage,
    reply_markup: TelegramReplyMarkup | undefined,
    reply_parameters: { message_id: number } | undefined,
  ): TelegramSendCall {
    return {
      method: 'sendMessage',
      params: this.compact({
        chat_id: chatId,
        text: m.text,
        link_preview_options: m.previewUrl ? undefined : { is_disabled: true },
        reply_markup,
        reply_parameters,
      }),
    };
  }

  private mapPhoto(
    chatId: number | string,
    m: ImageOutboundMessage,
    reply_markup: TelegramReplyMarkup | undefined,
    reply_parameters: { message_id: number } | undefined,
  ): TelegramSendCall {
    return {
      method: 'sendPhoto',
      params: this.compact({
        chat_id: chatId,
        photo: this.requireMediaSource(m.media, 'photo'),
        caption: m.media.caption,
        reply_markup,
        reply_parameters,
      }),
    };
  }

  private mapVideo(
    chatId: number | string,
    m: VideoOutboundMessage,
    reply_markup: TelegramReplyMarkup | undefined,
    reply_parameters: { message_id: number } | undefined,
  ): TelegramSendCall {
    return {
      method: 'sendVideo',
      params: this.compact({
        chat_id: chatId,
        video: this.requireMediaSource(m.media, 'video'),
        caption: m.media.caption,
        reply_markup,
        reply_parameters,
      }),
    };
  }

  private mapAudio(
    chatId: number | string,
    m: AudioOutboundMessage,
    reply_markup: TelegramReplyMarkup | undefined,
    reply_parameters: { message_id: number } | undefined,
  ): TelegramSendCall {
    // Voice notes use sendVoice; standard audio uses sendAudio.
    const method = m.voice ? 'sendVoice' : 'sendAudio';
    const fileField = m.voice ? 'voice' : 'audio';
    return {
      method,
      params: this.compact({
        chat_id: chatId,
        [fileField]: this.requireMediaSource(m.media, fileField),
        caption: m.media.caption,
        reply_markup,
        reply_parameters,
      }),
    };
  }

  private mapDocument(
    chatId: number | string,
    m: DocumentOutboundMessage,
    reply_markup: TelegramReplyMarkup | undefined,
    reply_parameters: { message_id: number } | undefined,
  ): TelegramSendCall {
    return {
      method: 'sendDocument',
      params: this.compact({
        chat_id: chatId,
        document: this.requireMediaSource(m.media, 'document'),
        caption: m.media.caption,
        reply_markup,
        reply_parameters,
      }),
    };
  }

  private mapSticker(
    chatId: number | string,
    m: StickerOutboundMessage,
    reply_parameters: { message_id: number } | undefined,
  ): TelegramSendCall {
    return {
      method: 'sendSticker',
      params: this.compact({
        chat_id: chatId,
        sticker: this.requireMediaSource(m.media, 'sticker'),
        reply_parameters,
      }),
    };
  }

  private mapLocation(
    chatId: number | string,
    m: LocationOutboundMessage,
    reply_parameters: { message_id: number } | undefined,
  ): TelegramSendCall {
    return {
      method: 'sendLocation',
      params: this.compact({
        chat_id: chatId,
        latitude: m.location.latitude,
        longitude: m.location.longitude,
        reply_parameters,
      }),
    };
  }

  private mapContact(chatId: number | string, m: ContactsOutboundMessage): TelegramSendCall {
    if (!m.contacts?.length) {
      throw new ProviderValidationError(ProviderType.TELEGRAM, 'At least one contact is required');
    }
    const c = m.contacts[0];
    const phone = c.phones?.[0]?.phone;
    if (!phone) {
      throw new ProviderValidationError(ProviderType.TELEGRAM, 'Contact must include a phone number');
    }
    return {
      method: 'sendContact',
      params: this.compact({
        chat_id: chatId,
        phone_number: phone,
        first_name: c.name?.first_name ?? c.name?.formatted_name ?? 'Contact',
        last_name: c.name?.last_name,
      }),
    };
  }

  private mapPoll(chatId: number | string, m: PollOutboundMessage): TelegramSendCall {
    if (m.poll.options.length < 2 || m.poll.options.length > 12) {
      throw new ProviderValidationError(
        ProviderType.TELEGRAM,
        'Telegram polls require between 2 and 12 options',
      );
    }
    return {
      method: 'sendPoll',
      params: this.compact({
        chat_id: chatId,
        question: m.poll.question,
        options: m.poll.options.map((o) => o.text),
        is_anonymous: m.poll.isAnonymous ?? true,
        allows_multiple_answers: m.poll.allowsMultipleAnswers ?? false,
        close_date: m.poll.closeDate ? Math.floor(m.poll.closeDate.getTime() / 1000) : undefined,
      }),
    };
  }

  private mapDice(chatId: number | string, m: DiceOutboundMessage): TelegramSendCall {
    return {
      method: 'sendDice',
      params: { chat_id: chatId, emoji: m.dice.emoji },
    };
  }

  private mapInteractiveAsText(
    chatId: number | string,
    m: InteractiveButtonsMessage | InteractiveListMessage | CardOutboundMessage,
    reply_markup: TelegramReplyMarkup | undefined,
    reply_parameters: { message_id: number } | undefined,
  ): TelegramSendCall {
    let body: string;
    if (m.type === MessageType.CARD) {
      body = m.cards.map((c) => `*${c.title}*${c.description ? `\n${c.description}` : ''}`).join('\n\n');
    } else if (m.type === MessageType.LIST_REPLY) {
      body = m.body;
    } else {
      body = m.body;
    }
    return {
      method: 'sendMessage',
      params: this.compact({
        chat_id: chatId,
        text: body,
        parse_mode: 'Markdown',
        reply_markup,
        reply_parameters,
      }),
    };
  }

  // ─── reply markup ────────────────────────────────────

  private buildReplyMarkup(message: OutboundMessage): TelegramReplyMarkup | undefined {
    if (message.type === MessageType.BUTTON_REPLY) {
      const inline_keyboard: TelegramInlineKeyboardButton[][] = [
        message.buttons.map((b) => ({ text: b.title, callback_data: b.id })),
      ];
      return { inline_keyboard };
    }
    if (message.type === MessageType.LIST_REPLY) {
      const inline_keyboard: TelegramInlineKeyboardButton[][] = message.sections.flatMap((s) =>
        s.rows.map((r) => [{ text: r.title, callback_data: r.id }]),
      );
      return { inline_keyboard };
    }
    if (message.type === MessageType.CARD) {
      const inline_keyboard: TelegramInlineKeyboardButton[][] = message.cards.flatMap((c) => {
        const row: TelegramInlineKeyboardButton[] = [];
        for (const b of c.buttons ?? []) row.push({ text: b.title, callback_data: b.id });
        if (c.url) row.push({ text: 'Abrir', url: c.url });
        return row.length > 0 ? [row] : [];
      });
      return inline_keyboard.length > 0 ? { inline_keyboard } : undefined;
    }
    return undefined;
  }

  private requireMediaSource(media: { url?: string; id?: string }, kind: string): string {
    if (media.id) return media.id;
    if (media.url) return media.url;
    throw new ProviderValidationError(
      ProviderType.TELEGRAM,
      `${kind} message requires either a public URL or a Telegram file_id`,
    );
  }

  private compact<T extends Record<string, unknown>>(obj: T): T {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined && v !== null) out[k] = v;
    }
    return out as T;
  }

  // Used by Provider when ReactionOutboundMessage arrives.
  asReaction(_m: ReactionOutboundMessage): never {
    throw new ProviderUnsupportedOperationError(
      ProviderType.TELEGRAM,
      'Use IMessagingProvider.addReaction with externalMessageId instead of OutboundMessage',
    );
  }
}

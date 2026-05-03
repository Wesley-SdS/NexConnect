import { describe, expect, it } from 'vitest';
import { MessageType, ProviderValidationError } from '@nexconnect/core';
import { TelegramMapper } from '../telegram.mapper';

describe('TelegramMapper', () => {
  const mapper = new TelegramMapper();
  const chatId = 123456789;

  it('maps a text message to sendMessage with link previews disabled by default', () => {
    const call = mapper.toSendCall(chatId, {
      type: MessageType.TEXT,
      to: String(chatId),
      text: 'Hello!',
    });

    expect(call.method).toBe('sendMessage');
    expect(call.params).toMatchObject({
      chat_id: chatId,
      text: 'Hello!',
      link_preview_options: { is_disabled: true },
    });
  });

  it('maps a photo with caption and reply context', () => {
    const call = mapper.toSendCall(chatId, {
      type: MessageType.IMAGE,
      to: String(chatId),
      media: { url: 'https://cdn/img.jpg', caption: 'pic' },
      context: { messageId: '42' },
    });
    expect(call.method).toBe('sendPhoto');
    expect(call.params).toMatchObject({
      chat_id: chatId,
      photo: 'https://cdn/img.jpg',
      caption: 'pic',
      reply_parameters: { message_id: 42 },
    });
  });

  it('uses sendVoice when audio.voice is true', () => {
    const call = mapper.toSendCall(chatId, {
      type: MessageType.AUDIO,
      to: String(chatId),
      media: { id: 'file_123' },
      voice: true,
    });
    expect(call.method).toBe('sendVoice');
    expect(call.params).toMatchObject({ voice: 'file_123' });
  });

  it('builds inline_keyboard for BUTTON_REPLY messages', () => {
    const call = mapper.toSendCall(chatId, {
      type: MessageType.BUTTON_REPLY,
      to: String(chatId),
      body: 'Pick',
      buttons: [
        { id: 'yes', title: 'Yes' },
        { id: 'no', title: 'No' },
      ],
    });
    expect(call.method).toBe('sendMessage');
    expect((call.params.reply_markup as { inline_keyboard: unknown }).inline_keyboard).toEqual([
      [
        { text: 'Yes', callback_data: 'yes' },
        { text: 'No', callback_data: 'no' },
      ],
    ]);
  });

  it('flattens LIST_REPLY sections into one button per row', () => {
    const call = mapper.toSendCall(chatId, {
      type: MessageType.LIST_REPLY,
      to: String(chatId),
      body: 'Menu',
      button: 'Pick',
      sections: [
        { title: 'main', rows: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }] },
      ],
    });
    expect((call.params.reply_markup as { inline_keyboard: unknown[][] }).inline_keyboard).toEqual([
      [{ text: 'A', callback_data: 'a' }],
      [{ text: 'B', callback_data: 'b' }],
    ]);
  });

  it('builds sendPoll payload from PollOutboundMessage', () => {
    const call = mapper.toSendCall(chatId, {
      type: MessageType.POLL,
      to: String(chatId),
      poll: {
        question: 'Color?',
        options: [{ text: 'red' }, { text: 'blue' }],
        allowsMultipleAnswers: true,
      },
    });
    expect(call.method).toBe('sendPoll');
    expect(call.params).toMatchObject({
      question: 'Color?',
      options: ['red', 'blue'],
      allows_multiple_answers: true,
    });
  });

  it('rejects polls with fewer than 2 options', () => {
    expect(() =>
      mapper.toSendCall(chatId, {
        type: MessageType.POLL,
        to: String(chatId),
        poll: { question: 'q', options: [{ text: 'one' }] },
      }),
    ).toThrow(ProviderValidationError);
  });

  it('maps DICE with default emoji', () => {
    const call = mapper.toSendCall(chatId, {
      type: MessageType.DICE,
      to: String(chatId),
      dice: { emoji: '🎲' },
    });
    expect(call).toMatchObject({ method: 'sendDice', params: { chat_id: chatId, emoji: '🎲' } });
  });

  it('rejects media without source url or id', () => {
    expect(() =>
      mapper.toSendCall(chatId, {
        type: MessageType.IMAGE,
        to: String(chatId),
        media: {},
      }),
    ).toThrow(ProviderValidationError);
  });

  it('builds reaction params with proper shape', () => {
    expect(mapper.toReactionParams(chatId, '42', '🎉')).toEqual({
      chat_id: chatId,
      message_id: 42,
      reaction: [{ type: 'emoji', emoji: '🎉' }],
    });
  });

  it('rejects reaction with non-numeric message id', () => {
    expect(() => mapper.toReactionParams(chatId, 'not-a-number', '🎉')).toThrow(
      ProviderValidationError,
    );
  });
});

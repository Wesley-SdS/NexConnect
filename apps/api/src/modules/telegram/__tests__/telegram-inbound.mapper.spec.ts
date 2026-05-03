import { describe, expect, it } from 'vitest';
import { MessageType, ProviderType } from '@nexconnect/core';
import { TelegramInboundMapper } from '../telegram-inbound.mapper';
import { TelegramUpdate } from '../types/telegram.types';

describe('TelegramInboundMapper', () => {
  const mapper = new TelegramInboundMapper();

  it('maps a private text message', () => {
    const update: TelegramUpdate = {
      update_id: 1,
      message: {
        message_id: 100,
        date: 1_700_000_000,
        from: { id: 555, is_bot: false, first_name: 'Wesley', last_name: 'S' },
        chat: { id: 555, type: 'private' },
        text: 'Olá',
      },
    };

    const { messages } = mapper.mapUpdate(update);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      provider: ProviderType.TELEGRAM,
      providerMessageId: '100',
      fromAddress: '555',
      toAddress: '555',
      type: MessageType.TEXT,
      text: 'Olá',
      contact: { profileName: 'Wesley S' },
    });
  });

  it('classifies /command messages as SLASH_COMMAND', () => {
    const update: TelegramUpdate = {
      update_id: 2,
      message: {
        message_id: 101,
        date: 1_700_000_000,
        from: { id: 555, is_bot: false, first_name: 'W' },
        chat: { id: 555, type: 'private' },
        text: '/start hello',
      },
    };
    const { messages } = mapper.mapUpdate(update);
    expect(messages[0].type).toBe(MessageType.SLASH_COMMAND);
  });

  it('routes /command@otherbot to TEXT when targeting a different bot', () => {
    const update: TelegramUpdate = {
      update_id: 3,
      message: {
        message_id: 102,
        date: 1_700_000_000,
        from: { id: 555, is_bot: false, first_name: 'W' },
        chat: { id: 555, type: 'private' },
        text: '/help@otherbot',
      },
    };
    const { messages } = mapper.mapUpdate(update, 'mybot');
    expect(messages[0].type).toBe(MessageType.TEXT);
  });

  it('extracts photo media from the largest size', () => {
    const update: TelegramUpdate = {
      update_id: 4,
      message: {
        message_id: 200,
        date: 1_700_000_000,
        chat: { id: 555, type: 'private' },
        photo: [
          { file_id: 'small', file_unique_id: 's', width: 90, height: 90 },
          { file_id: 'large', file_unique_id: 'l', width: 800, height: 600, file_size: 80_000 },
        ],
      },
    };
    const { messages } = mapper.mapUpdate(update);
    expect(messages[0].type).toBe(MessageType.IMAGE);
    expect(messages[0].media).toMatchObject({ providerMediaId: 'large', sizeBytes: 80_000 });
  });

  it('maps callback_query as BUTTON_REPLY with the callback_data id', () => {
    const update: TelegramUpdate = {
      update_id: 5,
      callback_query: {
        id: 'cbq-123',
        from: { id: 555, is_bot: false, first_name: 'W' },
        message: {
          message_id: 300,
          date: 1_700_000_000,
          chat: { id: 555, type: 'private' },
        },
        chat_instance: 'instance',
        data: 'option_a',
      },
    };
    const { messages } = mapper.mapUpdate(update);
    expect(messages[0]).toMatchObject({
      type: MessageType.BUTTON_REPLY,
      providerMessageId: 'cbq-123',
      replyTo: '300',
      interactive: { kind: 'button_reply', id: 'option_a' },
    });
  });

  it('maps poll_answer as POLL_VOTE message', () => {
    const update: TelegramUpdate = {
      update_id: 6,
      poll_answer: {
        poll_id: 'p1',
        user: { id: 555, is_bot: false, first_name: 'W', language_code: 'pt-BR' },
        option_ids: [1],
      },
    };
    const { messages } = mapper.mapUpdate(update);
    expect(messages[0].type).toBe(MessageType.POLL_VOTE);
    expect(messages[0].metadata).toMatchObject({ pollId: 'p1', optionIds: [1], language: 'pt-BR' });
  });

  it('detects voice notes vs regular audio', () => {
    const update: TelegramUpdate = {
      update_id: 7,
      message: {
        message_id: 400,
        date: 1_700_000_000,
        chat: { id: 555, type: 'private' },
        voice: { file_id: 'v1', file_unique_id: 'v1u', duration: 5, mime_type: 'audio/ogg' },
      },
    };
    const { messages } = mapper.mapUpdate(update);
    expect(messages[0].type).toBe(MessageType.AUDIO);
    expect(messages[0].media).toMatchObject({ mimeType: 'audio/ogg' });
  });
});

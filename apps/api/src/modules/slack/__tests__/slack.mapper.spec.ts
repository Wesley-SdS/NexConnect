import { describe, expect, it } from 'vitest';
import { MessageType, ProviderValidationError } from '@nexconnect/core';
import { SlackMapper } from '../slack.mapper';

describe('SlackMapper', () => {
  const mapper = new SlackMapper();
  const channel = 'C0123456789';

  it('maps text messages with thread_ts when context is set', () => {
    const params = mapper.toPostMessageParams(channel, {
      type: MessageType.TEXT,
      to: channel,
      text: 'Hi',
      context: { messageId: '1700000000.000100' },
    });
    expect(params).toMatchObject({
      channel,
      text: 'Hi',
      thread_ts: '1700000000.000100',
    });
  });

  it('builds an image block from media url', () => {
    const params = mapper.toPostMessageParams(channel, {
      type: MessageType.IMAGE,
      to: channel,
      media: { url: 'https://cdn/img.png', caption: 'hello' },
    });
    expect(params.text).toBe('hello');
    expect(params.blocks?.[0]).toMatchObject({
      type: 'image',
      image_url: 'https://cdn/img.png',
      alt_text: 'hello',
    });
  });

  it('builds an action row of buttons capped at 5 elements', () => {
    const params = mapper.toPostMessageParams(channel, {
      type: MessageType.BUTTON_REPLY,
      to: channel,
      body: 'Pick one',
      buttons: Array.from({ length: 7 }, (_, i) => ({ id: `b${i}`, title: `B${i}` })),
    });
    const actions = (params.blocks ?? []).find((b) => b.type === 'actions');
    expect(actions?.elements).toHaveLength(5);
  });

  it('builds a static_select for LIST_REPLY with up to 100 options', () => {
    const params = mapper.toPostMessageParams(channel, {
      type: MessageType.LIST_REPLY,
      to: channel,
      body: 'Menu',
      button: 'menu',
      sections: [
        {
          title: 's1',
          rows: [
            { id: 'a', title: 'A' },
            { id: 'b', title: 'B', description: 'second' },
          ],
        },
      ],
    });
    const actions = (params.blocks ?? []).find((b) => b.type === 'actions');
    const select = actions?.elements?.[0];
    expect(select?.type).toBe('static_select');
    expect(select?.options).toHaveLength(2);
  });

  it('builds card blocks with image accessory and button + link rows', () => {
    const params = mapper.toPostMessageParams(channel, {
      type: MessageType.CARD,
      to: channel,
      cards: [
        {
          title: 'Promo',
          description: 'Check this',
          imageUrl: 'https://cdn/c.png',
          url: 'https://example.com',
          buttons: [{ id: 'go', title: 'Go' }],
        },
      ],
    });
    expect(params.blocks?.[0]).toMatchObject({
      type: 'section',
      accessory: { type: 'image' },
    });
    const actions = (params.blocks ?? []).find((b) => b.type === 'actions');
    expect(actions?.elements).toHaveLength(2);
  });

  it('rejects image messages without media.url', () => {
    expect(() =>
      mapper.toPostMessageParams(channel, {
        type: MessageType.IMAGE,
        to: channel,
        media: { id: 'F123' },
      }),
    ).toThrow(ProviderValidationError);
  });
});

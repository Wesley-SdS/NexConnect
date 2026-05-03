import { describe, expect, it } from 'vitest';
import { MessageType, ProviderValidationError } from '@nexconnect/core';
import { DiscordMapper } from '../discord.mapper';

describe('DiscordMapper', () => {
  const mapper = new DiscordMapper();

  it('maps text messages with reply context', () => {
    const payload = mapper.toCreateMessagePayload({
      type: MessageType.TEXT,
      to: '123',
      text: 'Hello',
      context: { messageId: '999' },
    });
    expect(payload.content).toBe('Hello');
    expect(payload.message_reference).toEqual({
      message_id: '999',
      fail_if_not_exists: false,
    });
  });

  it('maps an image url to an embed', () => {
    const payload = mapper.toCreateMessagePayload({
      type: MessageType.IMAGE,
      to: '123',
      media: { url: 'https://cdn/img.png', caption: 'pic' },
    });
    expect(payload.embeds?.[0].image?.url).toBe('https://cdn/img.png');
    expect(payload.content).toBe('pic');
  });

  it('rejects media without a public URL (Discord lacks an upload endpoint)', () => {
    expect(() =>
      mapper.toCreateMessagePayload({
        type: MessageType.IMAGE,
        to: '123',
        media: { id: 'attach-id' },
      }),
    ).toThrow(ProviderValidationError);
  });

  it('builds an action row with up to 5 buttons', () => {
    const payload = mapper.toCreateMessagePayload({
      type: MessageType.BUTTON_REPLY,
      to: '123',
      body: 'Pick',
      buttons: [
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
      ],
    });
    expect(payload.components?.[0].type).toBe(1);
    expect(payload.components?.[0].components).toHaveLength(2);
  });

  it('rejects more than 5 buttons in a single action row', () => {
    expect(() =>
      mapper.toCreateMessagePayload({
        type: MessageType.BUTTON_REPLY,
        to: '123',
        body: 'too many',
        buttons: Array.from({ length: 6 }, (_, i) => ({ id: `${i}`, title: `${i}` })),
      }),
    ).toThrow(ProviderValidationError);
  });

  it('builds a string select for LIST_REPLY', () => {
    const payload = mapper.toCreateMessagePayload({
      type: MessageType.LIST_REPLY,
      to: '123',
      body: 'Menu',
      button: 'menu_select',
      sections: [
        {
          title: 'main',
          rows: [
            { id: 'opt1', title: 'Opt 1' },
            { id: 'opt2', title: 'Opt 2' },
          ],
        },
      ],
    });
    expect(payload.components?.[0].components?.[0].type).toBe(3);
    expect(payload.components?.[0].components?.[0].options).toHaveLength(2);
  });

  it('produces embeds + link buttons for CARD messages', () => {
    const payload = mapper.toCreateMessagePayload({
      type: MessageType.CARD,
      to: '123',
      cards: [
        {
          title: 'Card 1',
          description: 'desc',
          imageUrl: 'https://cdn/c1.png',
          url: 'https://example.com',
          buttons: [{ id: 'go', title: 'Go' }],
        },
      ],
    });
    expect(payload.embeds?.[0].title).toBe('Card 1');
    const buttons = payload.components?.[0].components ?? [];
    expect(buttons).toHaveLength(2); // primary + link
    expect(buttons[1]).toMatchObject({ style: 5, url: 'https://example.com' });
  });

  it('formats LOCATION as a maps link string', () => {
    const payload = mapper.toCreateMessagePayload({
      type: MessageType.LOCATION,
      to: '123',
      location: { latitude: -23.5, longitude: -46.6, name: 'SP' },
    });
    expect(payload.content).toContain('maps.google.com');
    expect(payload.content).toContain('-23.5');
  });
});

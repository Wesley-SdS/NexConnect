import { describe, expect, it } from 'vitest';
import { MessageType, ProviderType } from '@nexconnect/core';
import { DiscordInboundMapper } from '../discord-inbound.mapper';
import {
  DiscordInteraction,
  DiscordMessage,
  InteractionType,
} from '../types/discord.types';

describe('DiscordInboundMapper', () => {
  const mapper = new DiscordInboundMapper();

  it('returns null for PING interactions (handled before mapping)', () => {
    const ping: DiscordInteraction = {
      id: 'i1',
      application_id: 'a1',
      type: InteractionType.PING,
      token: 't',
    };
    expect(mapper.fromInteraction(ping)).toBeNull();
  });

  it('maps an APPLICATION_COMMAND interaction as SLASH_COMMAND', () => {
    const interaction: DiscordInteraction = {
      id: 'i2',
      application_id: 'a1',
      type: InteractionType.APPLICATION_COMMAND,
      token: 't',
      channel_id: 'ch1',
      user: { id: 'u1', username: 'wesley' },
      data: { name: 'nexconnect', type: 1 },
    };
    const inbound = mapper.fromInteraction(interaction)!;
    expect(inbound.provider).toBe(ProviderType.DISCORD);
    expect(inbound.type).toBe(MessageType.SLASH_COMMAND);
    expect(inbound.text).toBe('nexconnect');
  });

  it('maps a BUTTON click as BUTTON_REPLY with the custom_id', () => {
    const interaction: DiscordInteraction = {
      id: 'i3',
      application_id: 'a1',
      type: InteractionType.MESSAGE_COMPONENT,
      token: 't',
      channel_id: 'ch1',
      user: { id: 'u1', username: 'wesley' },
      data: { custom_id: 'option_a', component_type: 2 },
    };
    const inbound = mapper.fromInteraction(interaction)!;
    expect(inbound.type).toBe(MessageType.BUTTON_REPLY);
    expect(inbound.interactive).toMatchObject({ id: 'option_a' });
  });

  it('maps a string SELECT as LIST_REPLY with the chosen value', () => {
    const interaction: DiscordInteraction = {
      id: 'i4',
      application_id: 'a1',
      type: InteractionType.MESSAGE_COMPONENT,
      token: 't',
      channel_id: 'ch1',
      user: { id: 'u1', username: 'wesley' },
      data: { custom_id: 'menu', component_type: 3, values: ['opt2'] },
    };
    const inbound = mapper.fromInteraction(interaction)!;
    expect(inbound.type).toBe(MessageType.LIST_REPLY);
    expect(inbound.interactive).toMatchObject({ kind: 'list_reply', id: 'opt2' });
  });

  it('maps a regular DiscordMessage with image attachment to IMAGE', () => {
    const message: DiscordMessage = {
      id: 'm1',
      channel_id: 'ch1',
      author: { id: 'u1', username: 'wesley' },
      content: 'check this out',
      timestamp: '2026-01-01T00:00:00Z',
      attachments: [
        {
          id: 'a1',
          filename: 'pic.png',
          size: 1024,
          url: 'https://cdn/pic.png',
          proxy_url: 'https://cdn/pic.png',
          content_type: 'image/png',
        },
      ],
      embeds: [],
      type: 0,
    };
    const inbound = mapper.fromMessage(message);
    expect(inbound.type).toBe(MessageType.IMAGE);
    expect(inbound.media).toMatchObject({ url: 'https://cdn/pic.png', mimeType: 'image/png' });
  });
});

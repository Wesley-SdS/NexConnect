import { describe, expect, it } from 'vitest';
import { MessageType, ProviderType } from '@nexconnect/core';
import { SlackInboundMapper } from '../slack-inbound.mapper';
import {
  SlackEventCallback,
  SlackInteractivityPayload,
  SlackSlashCommandPayload,
} from '../types/slack.types';

describe('SlackInboundMapper', () => {
  const mapper = new SlackInboundMapper();

  it('skips bot echo messages', () => {
    const envelope: SlackEventCallback = {
      token: 't',
      team_id: 'T1',
      api_app_id: 'A1',
      type: 'event_callback',
      event: { type: 'message', subtype: 'bot_message', ts: '1.0', user: 'U_BOT', bot_id: 'B1' },
    };
    expect(mapper.fromEvent(envelope)).toBeNull();
  });

  it('maps user message events', () => {
    const envelope: SlackEventCallback = {
      token: 't',
      team_id: 'T1',
      api_app_id: 'A1',
      type: 'event_callback',
      event: {
        type: 'message',
        ts: '1700000000.000100',
        user: 'U123',
        text: 'Hello team',
        channel: 'C1',
        channel_type: 'channel',
      },
    };
    const inbound = mapper.fromEvent(envelope)!;
    expect(inbound.provider).toBe(ProviderType.SLACK);
    expect(inbound.type).toBe(MessageType.TEXT);
    expect(inbound.text).toBe('Hello team');
  });

  it('classifies file attachments by mimetype', () => {
    const envelope: SlackEventCallback = {
      token: 't',
      team_id: 'T1',
      api_app_id: 'A1',
      type: 'event_callback',
      event: {
        type: 'message',
        ts: '1700000000.000200',
        user: 'U123',
        text: '',
        channel: 'C1',
        files: [
          {
            id: 'F1',
            name: 'foto.jpg',
            mimetype: 'image/jpeg',
            url_private: 'https://files/private.jpg',
            url_private_download: 'https://files/d.jpg',
            size: 12345,
          },
        ],
      },
    };
    const inbound = mapper.fromEvent(envelope)!;
    expect(inbound.type).toBe(MessageType.IMAGE);
    expect(inbound.media).toMatchObject({ mimeType: 'image/jpeg', sizeBytes: 12345 });
  });

  it('maps reaction_added events', () => {
    const envelope: SlackEventCallback = {
      token: 't',
      team_id: 'T1',
      api_app_id: 'A1',
      type: 'event_callback',
      event: {
        type: 'reaction_added',
        ts: '1700000001.000000',
        user: 'U123',
        reaction: 'thumbsup',
        item: { type: 'message', channel: 'C1', ts: '1700000000.000100' },
      },
    };
    const inbound = mapper.fromEvent(envelope)!;
    expect(inbound.type).toBe(MessageType.REACTION);
    expect(inbound.reaction).toMatchObject({ emoji: ':thumbsup:' });
  });

  it('maps block_actions interactivity to BUTTON_REPLY', () => {
    const payload: SlackInteractivityPayload = {
      type: 'block_actions',
      team: { id: 'T1', domain: 'd' },
      user: { id: 'U123', username: 'wesley', team_id: 'T1' },
      api_app_id: 'A1',
      token: 'tk',
      trigger_id: 'tr',
      channel: { id: 'C1', name: 'general' },
      message: {
        type: 'message',
        ts: '1700000000.000300',
        user: 'U_BOT',
        text: '',
        channel: 'C1',
      } as never,
      actions: [
        {
          action_id: 'btn-yes',
          block_id: 'bk',
          type: 'button',
          value: 'yes',
        },
      ],
    };
    const inbound = mapper.fromInteractivity(payload)!;
    expect(inbound.type).toBe(MessageType.BUTTON_REPLY);
    expect(inbound.interactive).toMatchObject({ id: 'yes' });
  });

  it('maps static_select interactivity to LIST_REPLY', () => {
    const payload: SlackInteractivityPayload = {
      type: 'block_actions',
      team: { id: 'T1', domain: 'd' },
      user: { id: 'U123', username: 'wesley', team_id: 'T1' },
      api_app_id: 'A1',
      token: 'tk',
      trigger_id: 'tr',
      actions: [
        {
          action_id: 'menu',
          block_id: 'bk',
          type: 'static_select',
          selected_option: { value: 'option-2' },
        },
      ],
    };
    const inbound = mapper.fromInteractivity(payload)!;
    expect(inbound.type).toBe(MessageType.LIST_REPLY);
    expect(inbound.interactive).toMatchObject({ kind: 'list_reply', id: 'option-2' });
  });

  it('maps slash command to SLASH_COMMAND with command + args text', () => {
    const payload: SlackSlashCommandPayload = {
      token: 'tk',
      team_id: 'T1',
      team_domain: 'd',
      channel_id: 'C1',
      channel_name: 'general',
      user_id: 'U123',
      user_name: 'wesley',
      command: '/nexconnect',
      text: 'help',
      response_url: 'https://hooks.slack.com/x',
      trigger_id: 'tr',
      api_app_id: 'A1',
    };
    const inbound = mapper.fromSlashCommand(payload);
    expect(inbound.type).toBe(MessageType.SLASH_COMMAND);
    expect(inbound.text).toBe('/nexconnect help');
  });
});

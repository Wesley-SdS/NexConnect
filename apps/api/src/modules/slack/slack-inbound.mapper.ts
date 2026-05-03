import { Injectable } from '@nestjs/common';
import {
  InboundMessage,
  MessageType,
  ProviderType,
} from '@nexconnect/core';
import {
  SlackEventCallback,
  SlackInteractivityPayload,
  SlackSlashCommandPayload,
} from './types/slack.types';

@Injectable()
export class SlackInboundMapper {
  fromEvent(envelope: SlackEventCallback): InboundMessage | null {
    const event = envelope.event;
    if (!event) return null;

    if (event.type === 'message' && (event.subtype === 'bot_message' || event.bot_id)) {
      // Skip bot's own messages so we don't process echoes.
      return null;
    }

    if (event.type === 'message' || event.type === 'app_mention') {
      const file = event.files?.[0];
      const type = file
        ? this.classifyFile(file.mimetype)
        : MessageType.TEXT;

      return {
        provider: ProviderType.SLACK,
        providerMessageId: event.ts,
        fromAddress: event.user ?? '',
        toAddress: event.channel ?? '',
        contact: { messengerId: event.user ?? '' },
        timestamp: new Date(Number(event.ts) * 1000),
        type,
        text: event.text,
        replyTo: event.thread_ts !== event.ts ? event.thread_ts : undefined,
        media: file
          ? {
              url: file.url_private,
              mimeType: file.mimetype,
              filename: file.name,
              sizeBytes: file.size,
            }
          : undefined,
        metadata: {
          teamId: envelope.team_id,
          channelType: event.channel_type,
          eventType: event.type,
          subtype: event.subtype,
          edited: Boolean(event.edited),
        },
      };
    }

    if (event.type === 'reaction_added') {
      return {
        provider: ProviderType.SLACK,
        providerMessageId: event.item?.ts ?? event.ts,
        fromAddress: event.user ?? '',
        toAddress: event.item?.channel ?? '',
        contact: { messengerId: event.user ?? '' },
        timestamp: new Date(Number(event.ts) * 1000),
        type: MessageType.REACTION,
        reaction: event.reaction
          ? { messageId: event.item?.ts ?? '', emoji: `:${event.reaction}:` }
          : undefined,
        metadata: { teamId: envelope.team_id, eventType: event.type },
      };
    }

    return null;
  }

  fromInteractivity(payload: SlackInteractivityPayload): InboundMessage | null {
    if (payload.type === 'block_actions' && payload.actions?.length) {
      const action = payload.actions[0];
      const value = action.selected_option?.value ?? action.value ?? action.action_id;
      const messageId = payload.message?.ts ?? `action-${payload.trigger_id}`;
      const isSelect = action.type.includes('select');
      return {
        provider: ProviderType.SLACK,
        providerMessageId: messageId,
        fromAddress: payload.user.id,
        toAddress: payload.channel?.id ?? '',
        contact: { messengerId: payload.user.id, profileName: payload.user.username },
        timestamp: new Date(),
        type: isSelect ? MessageType.LIST_REPLY : MessageType.BUTTON_REPLY,
        replyTo: payload.message?.ts,
        interactive: { kind: isSelect ? 'list_reply' : 'button_reply', id: value, title: value },
        metadata: { teamId: payload.team.id, triggerId: payload.trigger_id },
      };
    }

    if (payload.type === 'view_submission' && payload.view) {
      return {
        provider: ProviderType.SLACK,
        providerMessageId: `view-${payload.view.id}`,
        fromAddress: payload.user.id,
        toAddress: payload.channel?.id ?? '',
        contact: { messengerId: payload.user.id, profileName: payload.user.username },
        timestamp: new Date(),
        type: MessageType.TEXT,
        metadata: {
          callbackId: payload.view.callback_id,
          state: payload.view.state.values,
          teamId: payload.team.id,
        },
      };
    }

    return null;
  }

  fromSlashCommand(payload: SlackSlashCommandPayload): InboundMessage {
    return {
      provider: ProviderType.SLACK,
      providerMessageId: `cmd-${payload.trigger_id}`,
      fromAddress: payload.user_id,
      toAddress: payload.channel_id,
      contact: { messengerId: payload.user_id, profileName: payload.user_name },
      timestamp: new Date(),
      type: MessageType.SLASH_COMMAND,
      text: `${payload.command} ${payload.text}`.trim(),
      metadata: {
        command: payload.command,
        responseUrl: payload.response_url,
        teamId: payload.team_id,
        teamDomain: payload.team_domain,
      },
    };
  }

  private classifyFile(mimeType: string): MessageType {
    if (mimeType.startsWith('image/')) return MessageType.IMAGE;
    if (mimeType.startsWith('video/')) return MessageType.VIDEO;
    if (mimeType.startsWith('audio/')) return MessageType.AUDIO;
    return MessageType.DOCUMENT;
  }
}

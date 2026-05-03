import { Injectable } from '@nestjs/common';
import {
  CardOutboundMessage,
  ImageOutboundMessage,
  InteractiveButtonsMessage,
  InteractiveListMessage,
  MessageType,
  OutboundMessage,
  ProviderType,
  ProviderUnsupportedOperationError,
  ProviderValidationError,
  TextOutboundMessage,
  VideoOutboundMessage,
  AudioOutboundMessage,
  DocumentOutboundMessage,
  StickerOutboundMessage,
} from '@nexconnect/core';
import {
  DiscordComponent,
  DiscordCreateMessagePayload,
  DiscordEmbed,
} from './types/discord.types';

const COMPONENT_TYPE_ACTION_ROW = 1;
const COMPONENT_TYPE_BUTTON = 2;
const COMPONENT_TYPE_STRING_SELECT = 3;
const BUTTON_STYLE_PRIMARY = 1;
const BUTTON_STYLE_LINK = 5;

@Injectable()
export class DiscordMapper {
  toCreateMessagePayload(message: OutboundMessage): DiscordCreateMessagePayload {
    const messageReference = message.context?.messageId
      ? { message_id: message.context.messageId, fail_if_not_exists: false }
      : undefined;

    switch (message.type) {
      case MessageType.TEXT:
        return this.text(message as TextOutboundMessage, messageReference);
      case MessageType.IMAGE:
      case MessageType.VIDEO:
      case MessageType.AUDIO:
      case MessageType.DOCUMENT:
      case MessageType.STICKER:
        return this.media(message, messageReference);
      case MessageType.LOCATION:
        return {
          content: this.formatLocation(
            (message as { location: { latitude: number; longitude: number; name?: string; address?: string } }).location,
          ),
          message_reference: messageReference,
        };
      case MessageType.BUTTON_REPLY:
        return this.buttons(message as InteractiveButtonsMessage, messageReference);
      case MessageType.LIST_REPLY:
        return this.list(message as InteractiveListMessage, messageReference);
      case MessageType.CARD:
        return this.cards(message as CardOutboundMessage, messageReference);
      default:
        throw new ProviderUnsupportedOperationError(
          ProviderType.DISCORD,
          `send:${(message as { type: string }).type}`,
        );
    }
  }

  // ─── text ────────────────────────────────────────────

  private text(
    m: TextOutboundMessage,
    messageReference: DiscordCreateMessagePayload['message_reference'],
  ): DiscordCreateMessagePayload {
    return {
      content: m.text,
      message_reference: messageReference,
    };
  }

  // ─── media (sent as embed when remote URL, content-only when not) ──

  private media(
    m:
      | ImageOutboundMessage
      | VideoOutboundMessage
      | AudioOutboundMessage
      | DocumentOutboundMessage
      | StickerOutboundMessage,
    messageReference: DiscordCreateMessagePayload['message_reference'],
  ): DiscordCreateMessagePayload {
    if (!m.media.url) {
      throw new ProviderValidationError(
        ProviderType.DISCORD,
        'Discord requires a public URL for media (no provider-side upload). Provide media.url.',
      );
    }

    const baseEmbed: DiscordEmbed = { description: m.media.caption };
    let embed: DiscordEmbed;

    switch (m.type) {
      case MessageType.IMAGE:
      case MessageType.STICKER:
        embed = { ...baseEmbed, image: { url: m.media.url } };
        break;
      default:
        // Video, audio and documents fall back to a plain link in the
        // message content; Discord renders previews automatically.
        return {
          content: m.media.caption ? `${m.media.caption}\n${m.media.url}` : m.media.url,
          message_reference: messageReference,
        };
    }

    return {
      content: m.media.caption,
      embeds: [embed],
      message_reference: messageReference,
    };
  }

  private formatLocation(loc: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  }): string {
    const label = loc.name ?? loc.address ?? `${loc.latitude}, ${loc.longitude}`;
    return `📍 **${label}**\nhttps://maps.google.com/?q=${loc.latitude},${loc.longitude}`;
  }

  // ─── interactive buttons ─────────────────────────────

  private buttons(
    m: InteractiveButtonsMessage,
    messageReference: DiscordCreateMessagePayload['message_reference'],
  ): DiscordCreateMessagePayload {
    if (m.buttons.length === 0 || m.buttons.length > 5) {
      throw new ProviderValidationError(
        ProviderType.DISCORD,
        'Discord action rows allow 1-5 buttons',
      );
    }
    const components: DiscordComponent[] = [
      {
        type: COMPONENT_TYPE_ACTION_ROW,
        components: m.buttons.map((b) => ({
          type: COMPONENT_TYPE_BUTTON,
          custom_id: b.id,
          label: b.title,
          style: BUTTON_STYLE_PRIMARY,
        })),
      },
    ];
    return {
      content: m.body,
      components,
      message_reference: messageReference,
    };
  }

  // ─── interactive list (string select) ────────────────

  private list(
    m: InteractiveListMessage,
    messageReference: DiscordCreateMessagePayload['message_reference'],
  ): DiscordCreateMessagePayload {
    const allRows = m.sections.flatMap((s) => s.rows);
    if (allRows.length === 0 || allRows.length > 25) {
      throw new ProviderValidationError(
        ProviderType.DISCORD,
        'Discord string select supports 1-25 options',
      );
    }
    const components: DiscordComponent[] = [
      {
        type: COMPONENT_TYPE_ACTION_ROW,
        components: [
          {
            type: COMPONENT_TYPE_STRING_SELECT,
            custom_id: m.button,
            placeholder: m.button,
            options: allRows.map((r) => ({
              label: r.title,
              value: r.id,
              description: r.description,
            })),
            min_values: 1,
            max_values: 1,
          },
        ],
      },
    ];
    return {
      content: m.body,
      components,
      message_reference: messageReference,
    };
  }

  // ─── cards (rich embeds) ─────────────────────────────

  private cards(
    m: CardOutboundMessage,
    messageReference: DiscordCreateMessagePayload['message_reference'],
  ): DiscordCreateMessagePayload {
    const embeds: DiscordEmbed[] = m.cards.map((c) => {
      const e: DiscordEmbed = { title: c.title, description: c.description, url: c.url };
      if (c.imageUrl) e.image = { url: c.imageUrl };
      return e;
    });

    const components: DiscordComponent[] = m.cards
      .map((c) => {
        const buttons: DiscordComponent[] = [];
        for (const b of c.buttons ?? []) {
          buttons.push({
            type: COMPONENT_TYPE_BUTTON,
            custom_id: b.id,
            label: b.title,
            style: BUTTON_STYLE_PRIMARY,
          });
        }
        if (c.url) {
          buttons.push({
            type: COMPONENT_TYPE_BUTTON,
            label: 'Abrir',
            style: BUTTON_STYLE_LINK,
            url: c.url,
          });
        }
        return buttons.length > 0
          ? { type: COMPONENT_TYPE_ACTION_ROW, components: buttons }
          : null;
      })
      .filter((c): c is { type: number; components: DiscordComponent[] } => c !== null);

    return {
      embeds,
      components: components.length > 0 ? components : undefined,
      message_reference: messageReference,
    };
  }
}

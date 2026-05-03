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
} from '@nexconnect/core';
import {
  SlackBlock,
  SlackBlockElement,
  SlackPostMessageParams,
} from './types/slack.types';

/**
 * Maps the normalized OutboundMessage to a chat.postMessage Slack
 * payload. Builds Block Kit blocks for interactive variants.
 */
@Injectable()
export class SlackMapper {
  toPostMessageParams(channel: string, message: OutboundMessage): SlackPostMessageParams {
    const threadTs = message.context?.messageId;
    const base: SlackPostMessageParams = { channel };
    if (threadTs) base.thread_ts = threadTs;

    switch (message.type) {
      case MessageType.TEXT:
        base.text = (message as TextOutboundMessage).text;
        break;
      case MessageType.IMAGE:
        base.text = message.media.caption;
        base.blocks = [this.imageBlock(message)];
        break;
      case MessageType.VIDEO:
      case MessageType.AUDIO:
      case MessageType.DOCUMENT:
      case MessageType.STICKER:
        base.text = this.formatMediaLink(message);
        break;
      case MessageType.LOCATION:
        base.text = this.formatLocation(message.location);
        break;
      case MessageType.BUTTON_REPLY:
        return { ...base, ...this.buildButtons(message as InteractiveButtonsMessage) };
      case MessageType.LIST_REPLY:
        return { ...base, ...this.buildList(message as InteractiveListMessage) };
      case MessageType.CARD:
        return { ...base, ...this.buildCards(message as CardOutboundMessage) };
      default:
        throw new ProviderUnsupportedOperationError(
          ProviderType.SLACK,
          `send:${(message as { type: string }).type}`,
        );
    }
    return base;
  }

  // ─── helpers ─────────────────────────────────────────

  private imageBlock(m: ImageOutboundMessage): SlackBlock {
    if (!m.media.url) {
      throw new ProviderValidationError(
        ProviderType.SLACK,
        'Slack image blocks require media.url (no inline upload supported here)',
      );
    }
    return {
      type: 'image',
      image_url: m.media.url,
      alt_text: m.media.caption ?? 'image',
    };
  }

  private formatMediaLink(message: Extract<OutboundMessage, { media: { url?: string; caption?: string } }>): string {
    if (!message.media.url) {
      throw new ProviderValidationError(
        ProviderType.SLACK,
        `Slack ${message.type} requires media.url (no provider-side upload here; use files.uploadV2)`,
      );
    }
    return message.media.caption
      ? `${message.media.caption}\n${message.media.url}`
      : message.media.url;
  }

  private formatLocation(loc: { latitude: number; longitude: number; name?: string; address?: string }): string {
    const label = loc.name ?? loc.address ?? `${loc.latitude}, ${loc.longitude}`;
    return `:round_pushpin: *${label}*\nhttps://maps.google.com/?q=${loc.latitude},${loc.longitude}`;
  }

  private buildButtons(m: InteractiveButtonsMessage): Pick<SlackPostMessageParams, 'text' | 'blocks'> {
    if (m.buttons.length === 0) {
      throw new ProviderValidationError(ProviderType.SLACK, 'At least one button is required');
    }
    const elements: SlackBlockElement[] = m.buttons.slice(0, 5).map((b) => ({
      type: 'button',
      text: { type: 'plain_text', text: b.title },
      action_id: b.id,
      value: b.id,
    }));
    return {
      text: m.body,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: m.body } },
        { type: 'actions', elements },
      ],
    };
  }

  private buildList(m: InteractiveListMessage): Pick<SlackPostMessageParams, 'text' | 'blocks'> {
    const allRows = m.sections.flatMap((s) => s.rows);
    if (allRows.length === 0 || allRows.length > 100) {
      throw new ProviderValidationError(
        ProviderType.SLACK,
        'Slack static_select supports 1-100 options',
      );
    }
    return {
      text: m.body,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: m.body } },
        {
          type: 'actions',
          elements: [
            {
              type: 'static_select',
              action_id: m.button,
              placeholder: { type: 'plain_text', text: m.button },
              options: allRows.map((r) => ({
                text: { type: 'plain_text' as const, text: r.title },
                value: r.id,
                description: r.description
                  ? { type: 'plain_text' as const, text: r.description }
                  : undefined,
              })),
            },
          ],
        },
      ],
    };
  }

  private buildCards(m: CardOutboundMessage): Pick<SlackPostMessageParams, 'text' | 'blocks'> {
    const blocks: SlackBlock[] = [];
    for (const c of m.cards) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: c.description ? `*${c.title}*\n${c.description}` : `*${c.title}*`,
        },
        accessory: c.imageUrl
          ? { type: 'image', image_url: c.imageUrl, alt_text: c.title }
          : undefined,
      });
      const actionElements: SlackBlockElement[] = [];
      for (const b of c.buttons ?? []) {
        actionElements.push({
          type: 'button',
          text: { type: 'plain_text', text: b.title },
          action_id: b.id,
          value: b.id,
        });
      }
      if (c.url) {
        actionElements.push({
          type: 'button',
          text: { type: 'plain_text', text: 'Abrir' },
          url: c.url,
          action_id: `${c.title}-link`,
        });
      }
      if (actionElements.length > 0) {
        blocks.push({ type: 'actions', elements: actionElements });
      }
    }
    return { text: m.cards.map((c) => c.title).join('\n'), blocks };
  }
}

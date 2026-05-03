import { Injectable } from '@nestjs/common';
import {
  AudioOutboundMessage,
  ContactsOutboundMessage,
  DocumentOutboundMessage,
  ImageOutboundMessage,
  InteractiveButtonsMessage,
  InteractiveListMessage,
  LocationOutboundMessage,
  MessageType,
  OutboundMessage,
  ProviderType,
  ProviderValidationError,
  ReactionOutboundMessage,
  StickerOutboundMessage,
  TemplateOutboundMessage,
  TextOutboundMessage,
  VideoOutboundMessage,
} from '@nexconnect/core';
import { PhoneUtil } from '@nexconnect/shared';

/**
 * Translates the internal normalized OutboundMessage into the JSON
 * payload accepted by POST {PHONE_NUMBER_ID}/messages on the
 * WhatsApp Business Cloud API.
 */
@Injectable()
export class WhatsAppCloudMapper {
  toGraphPayload(message: OutboundMessage): Record<string, unknown> {
    const to = this.normalizeRecipient(message.to);
    const base: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
    };

    switch (message.type) {
      case MessageType.TEMPLATE:
        return this.mapTemplate(base, message);
      case MessageType.FLOW:
        return this.mapFlow(base, message);
      case MessageType.TEXT:
        return this.mapText(base, message);
      case MessageType.IMAGE:
        return this.mapImage(base, message);
      case MessageType.VIDEO:
        return this.mapVideo(base, message);
      case MessageType.AUDIO:
        return this.mapAudio(base, message);
      case MessageType.DOCUMENT:
        return this.mapDocument(base, message);
      case MessageType.STICKER:
        return this.mapSticker(base, message);
      case MessageType.LOCATION:
        return this.mapLocation(base, message);
      case MessageType.VCARD:
        return this.mapContacts(base, message);
      case MessageType.REACTION:
        return this.mapReaction(base, message);
      case MessageType.BUTTON_REPLY:
        return this.mapInteractiveButtons(base, message);
      case MessageType.LIST_REPLY:
        return this.mapInteractiveList(base, message);
      default:
        throw new ProviderValidationError(
          ProviderType.META_WHATSAPP_CLOUD,
          `Unsupported message type for WhatsApp Cloud: ${(message as { type: string }).type}`,
        );
    }
  }

  private normalizeRecipient(to: string): string {
    if (!to) {
      throw new ProviderValidationError(
        ProviderType.META_WHATSAPP_CLOUD,
        'Recipient phone number is required',
      );
    }
    const normalized = PhoneUtil.normalize(to);
    return normalized.replace(/^\+/, '');
  }

  private withContext(
    payload: Record<string, unknown>,
    message: OutboundMessage,
  ): Record<string, unknown> {
    if (message.context?.messageId) {
      payload.context = { message_id: message.context.messageId };
    }
    return payload;
  }

  private mapText(base: Record<string, unknown>, m: TextOutboundMessage): Record<string, unknown> {
    return this.withContext(
      {
        ...base,
        type: 'text',
        text: {
          body: m.text,
          preview_url: m.previewUrl ?? false,
        },
      },
      m,
    );
  }

  private mapImage(base: Record<string, unknown>, m: ImageOutboundMessage): Record<string, unknown> {
    return this.withContext(
      {
        ...base,
        type: 'image',
        image: this.mediaPayload(m.media, true),
      },
      m,
    );
  }

  private mapVideo(base: Record<string, unknown>, m: VideoOutboundMessage): Record<string, unknown> {
    return this.withContext(
      {
        ...base,
        type: 'video',
        video: this.mediaPayload(m.media, true),
      },
      m,
    );
  }

  private mapAudio(base: Record<string, unknown>, m: AudioOutboundMessage): Record<string, unknown> {
    return this.withContext(
      {
        ...base,
        type: 'audio',
        audio: this.mediaPayload(m.media, false),
      },
      m,
    );
  }

  private mapDocument(
    base: Record<string, unknown>,
    m: DocumentOutboundMessage,
  ): Record<string, unknown> {
    const payload = this.mediaPayload(m.media, true);
    if (m.media.filename) {
      payload.filename = m.media.filename;
    }
    return this.withContext(
      {
        ...base,
        type: 'document',
        document: payload,
      },
      m,
    );
  }

  private mapSticker(
    base: Record<string, unknown>,
    m: StickerOutboundMessage,
  ): Record<string, unknown> {
    return this.withContext(
      {
        ...base,
        type: 'sticker',
        sticker: this.mediaPayload(m.media, false),
      },
      m,
    );
  }

  private mapLocation(
    base: Record<string, unknown>,
    m: LocationOutboundMessage,
  ): Record<string, unknown> {
    return this.withContext(
      {
        ...base,
        type: 'location',
        location: {
          latitude: m.location.latitude,
          longitude: m.location.longitude,
          name: m.location.name,
          address: m.location.address,
        },
      },
      m,
    );
  }

  private mapContacts(
    base: Record<string, unknown>,
    m: ContactsOutboundMessage,
  ): Record<string, unknown> {
    return this.withContext(
      {
        ...base,
        type: 'contacts',
        contacts: m.contacts,
      },
      m,
    );
  }

  private mapReaction(
    base: Record<string, unknown>,
    m: ReactionOutboundMessage,
  ): Record<string, unknown> {
    return {
      ...base,
      type: 'reaction',
      reaction: {
        message_id: m.reaction.messageId,
        emoji: m.reaction.emoji,
      },
    };
  }

  private mapInteractiveButtons(
    base: Record<string, unknown>,
    m: InteractiveButtonsMessage,
  ): Record<string, unknown> {
    if (m.buttons.length === 0 || m.buttons.length > 3) {
      throw new ProviderValidationError(
        ProviderType.META_WHATSAPP_CLOUD,
        'Interactive button messages require between 1 and 3 buttons',
      );
    }
    const interactive: Record<string, unknown> = {
      type: 'button',
      body: { text: m.body },
      action: {
        buttons: m.buttons.map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    };
    if (m.footer) interactive.footer = { text: m.footer };
    if (m.header) interactive.header = this.buildInteractiveHeader(m.header);
    return this.withContext({ ...base, type: 'interactive', interactive }, m);
  }

  private mapInteractiveList(
    base: Record<string, unknown>,
    m: InteractiveListMessage,
  ): Record<string, unknown> {
    if (m.sections.length === 0 || m.sections.length > 10) {
      throw new ProviderValidationError(
        ProviderType.META_WHATSAPP_CLOUD,
        'Interactive list messages require between 1 and 10 sections',
      );
    }
    const totalRows = m.sections.reduce((acc, s) => acc + s.rows.length, 0);
    if (totalRows > 10) {
      throw new ProviderValidationError(
        ProviderType.META_WHATSAPP_CLOUD,
        'Interactive list messages support at most 10 rows across all sections',
      );
    }
    const interactive: Record<string, unknown> = {
      type: 'list',
      body: { text: m.body },
      action: {
        button: m.button,
        sections: m.sections.map((s) => ({
          title: s.title,
          rows: s.rows.map((r) => ({ id: r.id, title: r.title, description: r.description })),
        })),
      },
    };
    if (m.header) interactive.header = { type: 'text', text: m.header };
    if (m.footer) interactive.footer = { text: m.footer };
    return this.withContext({ ...base, type: 'interactive', interactive }, m);
  }

  private mapFlow(
    base: Record<string, unknown>,
    m: import('@nexconnect/core').FlowOutboundMessage,
  ): Record<string, unknown> {
    const interactive: Record<string, unknown> = {
      type: 'flow',
      body: { text: m.flow.body ?? '' },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_token: m.flow.flowToken,
          flow_id: m.flow.flowId,
          flow_cta: m.flow.flowCta,
          flow_action: m.flow.flowAction ?? 'navigate',
          flow_action_payload: m.flow.screen
            ? { screen: m.flow.screen, data: m.flow.data }
            : undefined,
        },
      },
    };
    if (m.flow.header) interactive.header = { type: 'text', text: m.flow.header };
    if (m.flow.footer) interactive.footer = { text: m.flow.footer };
    return this.withContext({ ...base, type: 'interactive', interactive }, m);
  }

  private mapTemplate(
    base: Record<string, unknown>,
    m: TemplateOutboundMessage,
  ): Record<string, unknown> {
    const template: Record<string, unknown> = {
      name: m.template.name,
      language: { code: m.template.language },
    };
    if (m.template.components && m.template.components.length > 0) {
      template.components = m.template.components.map((c) => ({
        type: c.type,
        sub_type: c.subType,
        index: c.index,
        parameters: c.parameters.map((p) => this.mapTemplateParameter(p)),
      }));
    }
    return this.withContext({ ...base, type: 'template', template }, m);
  }

  private mapTemplateParameter(p: {
    type: string;
    value: string;
    mediaUrl?: string;
  }): Record<string, unknown> {
    switch (p.type) {
      case 'image':
        return { type: 'image', image: { link: p.mediaUrl ?? p.value } };
      case 'video':
        return { type: 'video', video: { link: p.mediaUrl ?? p.value } };
      case 'document':
        return { type: 'document', document: { link: p.mediaUrl ?? p.value } };
      case 'currency':
        try {
          const parsed = JSON.parse(p.value);
          return { type: 'currency', currency: parsed };
        } catch {
          throw new ProviderValidationError(
            ProviderType.META_WHATSAPP_CLOUD,
            `Invalid currency JSON in template parameter: ${p.value}`,
          );
        }
      case 'date_time':
        return { type: 'date_time', date_time: { fallback_value: p.value } };
      case 'payload':
        return { type: 'payload', payload: p.value };
      case 'text':
      default:
        return { type: 'text', text: p.value };
    }
  }

  private buildInteractiveHeader(
    header: InteractiveButtonsMessage['header'],
  ): Record<string, unknown> {
    if (!header) return {};
    switch (header.type) {
      case 'text':
        return { type: 'text', text: header.text };
      case 'image':
        return { type: 'image', image: this.mediaPayload(header.media!, false) };
      case 'video':
        return { type: 'video', video: this.mediaPayload(header.media!, false) };
      case 'document':
        return { type: 'document', document: this.mediaPayload(header.media!, false) };
      default:
        return {};
    }
  }

  private mediaPayload(
    media: { url?: string; id?: string; caption?: string },
    allowCaption: boolean,
  ): Record<string, unknown> {
    if (!media.url && !media.id) {
      throw new ProviderValidationError(
        ProviderType.META_WHATSAPP_CLOUD,
        'Media message requires either "url" or provider media "id"',
      );
    }
    const payload: Record<string, unknown> = media.id
      ? { id: media.id }
      : { link: media.url };
    if (allowCaption && media.caption) {
      payload.caption = media.caption;
    }
    return payload;
  }
}

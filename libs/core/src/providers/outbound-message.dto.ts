import { MessageType } from '../enums';

export interface MediaReference {
  url?: string;
  id?: string;
  mimeType?: string;
  filename?: string;
  caption?: string;
}

export interface ContextReference {
  messageId: string;
}

export interface LocationPayload {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface ContactPayload {
  name: { formatted_name: string; first_name?: string; last_name?: string };
  phones?: Array<{ phone: string; type?: string; wa_id?: string }>;
  emails?: Array<{ email: string; type?: string }>;
}

export interface InteractiveButton {
  id: string;
  title: string;
}

export interface InteractiveListRow {
  id: string;
  title: string;
  description?: string;
}

export interface InteractiveListSection {
  title?: string;
  rows: InteractiveListRow[];
}

export interface TemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video' | 'payload';
  value: string;
  mediaUrl?: string;
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button' | 'footer';
  subType?: 'quick_reply' | 'url' | 'catalog';
  index?: number;
  parameters: TemplateParameter[];
}

interface OutboundBase {
  to: string;
  context?: ContextReference;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface TextOutboundMessage extends OutboundBase {
  type: MessageType.TEXT;
  text: string;
  previewUrl?: boolean;
}

export interface ImageOutboundMessage extends OutboundBase {
  type: MessageType.IMAGE;
  media: MediaReference;
}

export interface VideoOutboundMessage extends OutboundBase {
  type: MessageType.VIDEO;
  media: MediaReference;
}

export interface AudioOutboundMessage extends OutboundBase {
  type: MessageType.AUDIO;
  media: MediaReference;
  voice?: boolean;
}

export interface DocumentOutboundMessage extends OutboundBase {
  type: MessageType.DOCUMENT;
  media: MediaReference;
}

export interface StickerOutboundMessage extends OutboundBase {
  type: MessageType.STICKER;
  media: MediaReference;
}

export interface LocationOutboundMessage extends OutboundBase {
  type: MessageType.LOCATION;
  location: LocationPayload;
}

export interface ContactsOutboundMessage extends OutboundBase {
  type: MessageType.VCARD;
  contacts: ContactPayload[];
}

export interface ReactionOutboundMessage extends OutboundBase {
  type: MessageType.REACTION;
  reaction: { messageId: string; emoji: string };
}

export interface InteractiveButtonsMessage extends OutboundBase {
  type: MessageType.BUTTON_REPLY;
  header?: { type: 'text' | 'image' | 'video' | 'document'; text?: string; media?: MediaReference };
  body: string;
  footer?: string;
  buttons: InteractiveButton[];
}

export interface InteractiveListMessage extends OutboundBase {
  type: MessageType.LIST_REPLY;
  header?: string;
  body: string;
  footer?: string;
  button: string;
  sections: InteractiveListSection[];
}

export interface TemplateOutboundMessage extends OutboundBase {
  type: MessageType.TEMPLATE;
  template: {
    name: string;
    language: string;
    components?: TemplateComponent[];
  };
}

export type OutboundMessage =
  | TextOutboundMessage
  | ImageOutboundMessage
  | VideoOutboundMessage
  | AudioOutboundMessage
  | DocumentOutboundMessage
  | StickerOutboundMessage
  | LocationOutboundMessage
  | ContactsOutboundMessage
  | ReactionOutboundMessage
  | InteractiveButtonsMessage
  | InteractiveListMessage
  | TemplateOutboundMessage;

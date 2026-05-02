import { MessageType } from '../enums';
import { ProviderType } from './provider-type.enum';

export interface InboundMediaReference {
  providerMediaId?: string;
  url?: string;
  mimeType: string;
  sha256?: string;
  filename?: string;
  sizeBytes?: number;
  caption?: string;
}

export interface InboundContact {
  profileName?: string;
  waId?: string;
  phone?: string;
  instagramId?: string;
  messengerId?: string;
}

export interface InboundMessage {
  provider: ProviderType;
  providerMessageId: string;
  fromAddress: string;
  toAddress: string;
  contact: InboundContact;
  timestamp: Date;
  type: MessageType;
  replyTo?: string;
  text?: string;
  media?: InboundMediaReference;
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  reaction?: { messageId: string; emoji: string };
  interactive?: {
    kind: 'button_reply' | 'list_reply';
    id: string;
    title: string;
    description?: string;
  };
  metadata?: Record<string, unknown>;
}

export enum InboundStatusKind {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

export interface InboundStatusUpdate {
  provider: ProviderType;
  providerMessageId: string;
  recipientId?: string;
  status: InboundStatusKind;
  timestamp: Date;
  errorCode?: string;
  errorReason?: string;
  pricing?: { category?: string; billable?: boolean; currency?: string };
}

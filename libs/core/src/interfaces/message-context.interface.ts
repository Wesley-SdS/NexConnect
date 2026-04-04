import { MessageType } from '../enums';

export interface MediaAssetRef {
  type: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  r2Key?: string;
  transcription?: string;
}

export interface MessageContext {
  id: string;
  rawMessage: any;
  instanceId: string;
  tenantId?: string | null;
  messageType?: MessageType;
  processedContent?: Record<string, unknown>;
  mediaAssets?: MediaAssetRef[];
  metadata?: Record<string, unknown>;
  timestamps?: {
    receivedAt: Date;
    processedAt?: Date;
    sentAt?: Date;
  };
  receivedAt?: number;
  buffered?: boolean;
  bufferedText?: string;
  bufferedMessagesCount?: number;
  normalizedPhone?: string | null;
  isGroup?: boolean;
  profileName?: string | null;
  mediaUrl?: string;
  transcription?: string;
}

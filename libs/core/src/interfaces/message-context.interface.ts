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
  rawMessage: Record<string, unknown>;
  instanceId: string;
  tenantId: string;
  messageType: MessageType;
  processedContent: Record<string, unknown>;
  mediaAssets: MediaAssetRef[];
  metadata: Record<string, unknown>;
  timestamps: {
    receivedAt: Date;
    processedAt?: Date;
    sentAt?: Date;
  };
  buffered: boolean;
}

import { ProviderType } from './provider-type.enum';

export interface ProviderSendSuccess {
  ok: true;
  provider: ProviderType;
  externalMessageId: string;
  recipientId?: string;
  acceptedAt: Date;
  raw?: unknown;
}

export interface ProviderSendFailure {
  ok: false;
  provider: ProviderType;
  code: string;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
  httpStatus?: number;
  raw?: unknown;
}

export type ProviderSendResult = ProviderSendSuccess | ProviderSendFailure;

export interface ProviderMediaUploadResult {
  provider: ProviderType;
  providerMediaId: string;
  mimeType: string;
  sizeBytes?: number;
  expiresAt?: Date;
}

export interface ProviderMediaDownloadResult {
  provider: ProviderType;
  providerMediaId: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
  sha256?: string;
}

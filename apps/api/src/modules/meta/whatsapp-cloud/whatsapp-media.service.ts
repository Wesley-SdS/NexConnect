import { Injectable, Logger } from '@nestjs/common';
import { ProviderContext } from '@nexconnect/core';
import { WhatsAppCloudProvider } from './whatsapp-cloud.provider';

export interface UploadRequest {
  buffer: Buffer;
  mimeType: string;
  filename?: string;
}

export interface DownloadResult {
  buffer: Buffer;
  mimeType: string;
  sizeBytes: number;
  sha256?: string;
}

/**
 * Public-facing media service. Keeps upload/download logic reusable
 * from multiple flows (API controllers, worker pipeline stages).
 */
@Injectable()
export class WhatsAppMediaService {
  private readonly logger = new Logger(WhatsAppMediaService.name);

  constructor(private readonly provider: WhatsAppCloudProvider) {}

  async upload(
    context: ProviderContext,
    request: UploadRequest,
  ): Promise<{ providerMediaId: string; mimeType: string; sizeBytes: number }> {
    const result = await this.provider.uploadMedia(context, request);
    this.logger.log(
      {
        tenantId: context.tenantId,
        instanceId: context.instanceId,
        providerMediaId: result.providerMediaId,
        sizeBytes: result.sizeBytes,
      },
      'meta.whatsapp.media.uploaded',
    );
    return {
      providerMediaId: result.providerMediaId,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes ?? request.buffer.byteLength,
    };
  }

  async download(context: ProviderContext, providerMediaId: string): Promise<DownloadResult> {
    const result = await this.provider.downloadMedia(context, providerMediaId);
    this.logger.log(
      {
        tenantId: context.tenantId,
        instanceId: context.instanceId,
        providerMediaId,
        sizeBytes: result.sizeBytes,
        sha256: result.sha256,
      },
      'meta.whatsapp.media.downloaded',
    );
    return {
      buffer: result.buffer,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
      sha256: result.sha256,
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ProviderType } from '@nexconnect/core';
import { PrismaService } from '@nexconnect/database';
import { MediaUploadService } from '../media/media-upload.service';
import { WhatsAppMediaService } from '../meta/whatsapp-cloud/whatsapp-media.service';

export interface IngestInput {
  tenantId: string;
  instanceId: string;
  credentialId: string;
  messageId: string;
  provider: ProviderType;
  providerMediaId?: string;
  mediaUrl?: string;
  mimeType: string;
  caption?: string;
}

/**
 * Downloads media referenced by an inbound webhook event, uploads it to
 * R2, and persists a MediaAsset row linked to the inbound Message. Runs
 * fire-and-forget from webhook handlers so signature acknowledgement
 * stays under Meta/Twilio's 20-second timeout.
 */
@Injectable()
export class ProviderMediaIngestionService {
  private readonly logger = new Logger(ProviderMediaIngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploader: MediaUploadService,
    private readonly whatsappMedia: WhatsAppMediaService,
  ) {}

  async ingest(input: IngestInput): Promise<void> {
    try {
      const buffer = await this.download(input);
      if (!buffer) return;

      const uploaded = await this.uploader.upload(
        buffer.data,
        buffer.mimeType,
        input.tenantId,
        input.instanceId,
      );

      const type = this.mapMediaType(buffer.mimeType);
      await this.prisma.mediaAsset.create({
        data: {
          tenantId: input.tenantId,
          instanceId: input.instanceId,
          messageId: input.messageId,
          type,
          r2Key: uploaded.key,
          url: uploaded.url,
          sizeBytes: uploaded.size,
          mimeType: uploaded.contentType,
        },
      });

      this.logger.log(
        {
          provider: input.provider,
          messageId: input.messageId,
          r2Key: uploaded.key,
          sizeBytes: uploaded.size,
        },
        'provider.media.ingested',
      );
    } catch (err) {
      this.logger.error(
        {
          provider: input.provider,
          messageId: input.messageId,
          err: (err as Error).message,
        },
        'provider.media.ingestion-failed',
      );
    }
  }

  private async download(
    input: IngestInput,
  ): Promise<{ data: Buffer; mimeType: string } | null> {
    if (input.provider === ProviderType.META_WHATSAPP_CLOUD && input.providerMediaId) {
      const result = await this.whatsappMedia.download(
        {
          tenantId: input.tenantId,
          instanceId: input.instanceId,
          credentialId: input.credentialId,
        },
        input.providerMediaId,
      );
      return { data: result.buffer, mimeType: result.mimeType };
    }

    if (input.mediaUrl) {
      // Twilio media URLs are presigned for ~1 hour. Meta Instagram/Messenger
      // attachment URLs are similarly time-bound. Fetch directly.
      const response = await fetch(input.mediaUrl);
      if (!response.ok) {
        throw new Error(
          `Media download failed (${response.status}) for url ${input.mediaUrl}`,
        );
      }
      const arrayBuffer = await response.arrayBuffer();
      const contentType =
        response.headers.get('content-type') ?? input.mimeType ?? 'application/octet-stream';
      return { data: Buffer.from(arrayBuffer), mimeType: contentType };
    }

    this.logger.warn(
      {
        provider: input.provider,
        messageId: input.messageId,
      },
      'provider.media.ingestion.no-source',
    );
    return null;
  }

  private mapMediaType(mimeType: string): 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'STICKER' {
    if (mimeType.startsWith('image/')) {
      return mimeType.includes('webp') ? 'STICKER' : 'IMAGE';
    }
    if (mimeType.startsWith('audio/')) return 'AUDIO';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    return 'DOCUMENT';
  }
}

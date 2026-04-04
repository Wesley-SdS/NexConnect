import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@nexconnect/redis';
import {
  RateLimitExceededException,
  MediaProcessingException,
  MEDIA_UPLOAD_RATE_LIMIT_MB_PER_MIN,
} from '@nexconnect/shared';
import {
  IOutboundPipelineStage,
  OutboundMessage,
} from './outbound-pipeline-stage.interface';

const MEDIA_UPLOAD_WINDOW_SECONDS = 60;
const MEDIA_UPLOAD_LIMIT_BYTES = MEDIA_UPLOAD_RATE_LIMIT_MB_PER_MIN * 1024 * 1024;

const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'document', 'sticker']);

@Injectable()
export class MediaPreparationStage implements IOutboundPipelineStage {
  private readonly logger = new Logger(MediaPreparationStage.name);

  constructor(private readonly redis: RedisService) {}

  async execute(message: OutboundMessage): Promise<void> {
    if (!MEDIA_TYPES.has(message.type)) {
      return;
    }

    if (!message.content.url) {
      throw new MediaProcessingException(
        'Media URL is required for type ' + message.type,
      );
    }

    try {
      new URL(message.content.url);
    } catch {
      throw new MediaProcessingException(
        'Invalid media URL: ' + message.content.url,
      );
    }

    if (message.content.sizeBytes) {
      const uploadKey = `rate:media:upload:${message.tenantId}`;
      const currentBytes = await this.redis.incrbyWithTtl(
        uploadKey,
        message.content.sizeBytes,
        MEDIA_UPLOAD_WINDOW_SECONDS,
      );
      if (currentBytes > MEDIA_UPLOAD_LIMIT_BYTES) {
        throw new RateLimitExceededException(
          'Media upload rate limit exceeded',
        );
      }
    }

    this.logger.log(
      {
        messageId: message.messageId,
        instanceId: message.instanceId,
        mediaType: message.type,
      },
      'media.prepare.validated',
    );
  }
}

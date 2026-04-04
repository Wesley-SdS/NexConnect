import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RedisService } from '@nexconnect/redis';

interface DownloadedMedia {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

@Injectable()
export class MediaDownloadService {
  private readonly logger = new Logger(MediaDownloadService.name);

  constructor(private readonly redis: RedisService) {}

  async downloadFromWhatsApp(
    instanceId: string,
    mediaKey: string,
    directPath: string,
    mediaType: string,
  ): Promise<DownloadedMedia> {
    const cacheKey = `media:cache:${instanceId}:${mediaKey}`;
    const cached = await this.redis.getBuffer(cacheKey);

    if (cached) {
      this.logger.log({ mediaKey }, 'Media served from cache');
      return {
        buffer: cached,
        contentType: this.resolveContentType(mediaType),
        filename: `${mediaKey}.${this.resolveExtension(mediaType)}`,
      };
    }

    this.logger.log(
      { instanceId, mediaKey, directPath },
      'Requesting media download from worker',
    );

    throw new NotFoundException(
      'Media download must be processed via worker. Enqueue a download job.',
    );
  }

  async cacheMedia(
    instanceId: string,
    mediaKey: string,
    buffer: Buffer,
    ttlSeconds: number = 3600,
  ): Promise<void> {
    const cacheKey = `media:cache:${instanceId}:${mediaKey}`;
    await this.redis.set(cacheKey, buffer, 'EX', ttlSeconds);
  }

  private resolveContentType(mediaType: string): string {
    const map: Record<string, string> = {
      image: 'image/jpeg',
      video: 'video/mp4',
      audio: 'audio/ogg',
      document: 'application/octet-stream',
      sticker: 'image/webp',
    };

    return map[mediaType] ?? 'application/octet-stream';
  }

  private resolveExtension(mediaType: string): string {
    const map: Record<string, string> = {
      image: 'jpg',
      video: 'mp4',
      audio: 'ogg',
      document: 'bin',
      sticker: 'webp',
    };

    return map[mediaType] ?? 'bin';
  }
}

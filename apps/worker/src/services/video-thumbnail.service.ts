import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { WorkerMediaUploadService } from './media-upload.service';

const execFileAsync = promisify(execFile);

@Injectable()
export class VideoThumbnailService {
  private readonly logger = new Logger(VideoThumbnailService.name);

  private static readonly THUMBNAIL_WIDTH = 320;
  private static readonly THUMBNAIL_HEIGHT = 240;
  private static readonly THUMBNAIL_QUALITY = 60;

  constructor(
    private readonly mediaUploadService: WorkerMediaUploadService,
  ) {}

  async generateAndUpload(
    videoBuffer: Buffer,
    instanceId: string,
    messageId: string,
  ): Promise<string> {
    this.logger.debug('Generating video thumbnail', { instanceId, messageId });

    const rawFrame = await this.extractFrame(videoBuffer);
    const thumbnail = await this.compressFrame(rawFrame);

    const url = await this.mediaUploadService.upload(
      thumbnail,
      instanceId,
      `thumb-${messageId}`,
      'image/jpeg',
    );

    this.logger.log('Video thumbnail generated and uploaded', {
      instanceId,
      messageId,
      thumbnailSize: thumbnail.length,
      url,
    });

    return url;
  }

  private async extractFrame(videoBuffer: Buffer): Promise<Buffer> {
    const inputPath = join(tmpdir(), `nexc-thumb-in-${randomUUID()}.mp4`);
    const outputPath = join(tmpdir(), `nexc-thumb-out-${randomUUID()}.png`);

    try {
      await writeFile(inputPath, videoBuffer);

      await execFileAsync('ffmpeg', [
        '-i', inputPath,
        '-y',
        '-ss', '1',
        '-frames:v', '1',
        '-f', 'image2',
        outputPath,
      ], { timeout: 30_000 });

      return await readFile(outputPath);
    } finally {
      await this.cleanupFiles(inputPath, outputPath);
    }
  }

  private async compressFrame(frameBuffer: Buffer): Promise<Buffer> {
    return sharp(frameBuffer)
      .resize(
        VideoThumbnailService.THUMBNAIL_WIDTH,
        VideoThumbnailService.THUMBNAIL_HEIGHT,
        { fit: 'cover' },
      )
      .jpeg({ quality: VideoThumbnailService.THUMBNAIL_QUALITY })
      .toBuffer();
  }

  private async cleanupFiles(...paths: string[]): Promise<void> {
    for (const filePath of paths) {
      try {
        await unlink(filePath);
      } catch {
        // Arquivo já removido ou inexistente
      }
    }
  }
}

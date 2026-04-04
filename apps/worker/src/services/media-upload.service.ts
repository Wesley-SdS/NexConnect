import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { UlidUtil } from '@nexconnect/shared';

@Injectable()
export class WorkerMediaUploadService {
  private readonly logger = new Logger(WorkerMediaUploadService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly publicBaseUrl: string;

  constructor() {
    this.bucketName = process.env.R2_BUCKET_NAME ?? 'nexconnect-media';
    this.publicBaseUrl =
      process.env.R2_PUBLIC_URL ?? 'https://media.nexconnect.io';

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT ?? '',
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
      },
    });
  }

  async upload(
    buffer: Buffer,
    instanceId: string,
    messageId: string,
    mimetype: string,
  ): Promise<string> {
    const extension = this.getExtensionFromMime(mimetype);
    const objectKey = `${instanceId}/${UlidUtil.generate()}${extension}`;

    this.logger.debug('Uploading media to R2', {
      instanceId,
      messageId,
      objectKey,
      mimetype,
      size: buffer.length,
    });

    const params: PutObjectCommandInput = {
      Bucket: this.bucketName,
      Key: objectKey,
      Body: buffer,
      ContentType: mimetype,
      CacheControl: 'public, max-age=31536000, immutable',
    };

    await this.s3Client.send(new PutObjectCommand(params));

    const permanentUrl = `${this.publicBaseUrl}/${objectKey}`;

    this.logger.log('Media uploaded', {
      instanceId,
      messageId,
      objectKey,
      url: permanentUrl,
    });

    return permanentUrl;
  }

  private getExtensionFromMime(mimetype: string): string {
    const mimeMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'video/3gpp': '.3gp',
      'audio/ogg': '.ogg',
      'audio/ogg; codecs=opus': '.ogg',
      'audio/mpeg': '.mp3',
      'audio/mp4': '.m4a',
      'application/pdf': '.pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        '.docx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        '.xlsx',
      'image/webp; animated=true': '.webp',
    };

    return mimeMap[mimetype] ?? '.bin';
  }
}

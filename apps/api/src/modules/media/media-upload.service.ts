import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { UlidUtil } from '@nexconnect/shared';

interface UploadResult {
  key: string;
  url: string;
  contentType: string;
  size: number;
}

@Injectable()
export class MediaUploadService {
  private readonly logger = new Logger(MediaUploadService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor() {
    this.bucket = process.env.R2_BUCKET ?? 'nexconnect-media';
    this.publicUrl = process.env.R2_PUBLIC_URL ?? '';

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
    contentType: string,
    tenantId: string,
    instanceId: string,
  ): Promise<UploadResult> {
    const extension = this.getExtension(contentType);
    const key = `${tenantId}/${instanceId}/${UlidUtil.generate()}.${extension}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    this.logger.log(
      { key, contentType, size: buffer.length },
      'Media uploaded to R2',
    );

    return {
      key,
      url: `${this.publicUrl}/${key}`,
      contentType,
      size: buffer.length,
    };
  }

  async uploadFromUrl(
    sourceUrl: string,
    contentType: string,
    tenantId: string,
    instanceId: string,
  ): Promise<UploadResult> {
    const response = await fetch(sourceUrl);

    if (!response.ok) {
      throw new Error(`Failed to download media from ${sourceUrl}: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    return this.upload(buffer, contentType, tenantId, instanceId);
  }

  private getExtension(contentType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'audio/ogg': 'ogg',
      'audio/mpeg': 'mp3',
      'application/pdf': 'pdf',
      'application/octet-stream': 'bin',
    };

    return map[contentType] ?? 'bin';
  }
}

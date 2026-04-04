import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const execFileAsync = promisify(execFile);

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export interface VideoCompressionOptions {
  maxDurationSeconds?: number;
  maxSizeMb?: number;
  resolution?: '480p' | '720p' | '1080p';
}

const RESOLUTION_MAP: Record<string, string> = {
  '480p': '854:480',
  '720p': '1280:720',
  '1080p': '1920:1080',
};

@Injectable()
export class MediaCompressionService {
  private readonly logger = new Logger(MediaCompressionService.name);

  async compressImage(
    buffer: Buffer,
    options: ImageCompressionOptions = {},
  ): Promise<Buffer> {
    const inputSize = buffer.length;
    this.logger.debug('Compressing image', { inputSize, options });

    const format = options.format ?? 'webp';
    const quality = options.quality ?? 80;

    let pipeline = sharp(buffer);

    if (options.maxWidth || options.maxHeight) {
      pipeline = pipeline.resize(options.maxWidth, options.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    pipeline = pipeline[format]({ quality });

    const result = await pipeline.toBuffer();

    const ratio = ((1 - result.length / inputSize) * 100).toFixed(1);
    this.logger.log('Image compressed', {
      inputSize,
      outputSize: result.length,
      compressionRatio: `${ratio}%`,
      format,
    });

    return result;
  }

  async compressVideo(
    buffer: Buffer,
    options: VideoCompressionOptions = {},
  ): Promise<Buffer> {
    const inputSize = buffer.length;
    this.logger.debug('Compressing video', { inputSize, options });

    const inputPath = join(tmpdir(), `nexc-vin-${randomUUID()}.mp4`);
    const outputPath = join(tmpdir(), `nexc-vout-${randomUUID()}.mp4`);

    try {
      await writeFile(inputPath, buffer);

      const args: string[] = [
        '-i', inputPath,
        '-y',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '28',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
      ];

      const resolution = options.resolution ?? '720p';
      const scale = RESOLUTION_MAP[resolution];
      args.push('-vf', `scale=${scale}:force_original_aspect_ratio=decrease`);

      if (options.maxDurationSeconds) {
        args.push('-t', String(options.maxDurationSeconds));
      }

      args.push(outputPath);

      await execFileAsync('ffmpeg', args, { timeout: 120_000 });

      const result = await readFile(outputPath);

      const ratio = ((1 - result.length / inputSize) * 100).toFixed(1);
      this.logger.log('Video compressed', {
        inputSize,
        outputSize: result.length,
        compressionRatio: `${ratio}%`,
        resolution,
      });

      return result;
    } finally {
      await this.cleanupFiles(inputPath, outputPath);
    }
  }

  async compressAudio(buffer: Buffer): Promise<Buffer> {
    const inputSize = buffer.length;
    this.logger.debug('Compressing audio', { inputSize });

    const inputPath = join(tmpdir(), `nexc-ain-${randomUUID()}`);
    const outputPath = join(tmpdir(), `nexc-aout-${randomUUID()}.ogg`);

    try {
      await writeFile(inputPath, buffer);

      await execFileAsync('ffmpeg', [
        '-i', inputPath,
        '-y',
        '-c:a', 'libopus',
        '-b:a', '64k',
        '-vbr', 'on',
        '-application', 'voip',
        outputPath,
      ], { timeout: 60_000 });

      const result = await readFile(outputPath);

      const ratio = ((1 - result.length / inputSize) * 100).toFixed(1);
      this.logger.log('Audio compressed', {
        inputSize,
        outputSize: result.length,
        compressionRatio: `${ratio}%`,
      });

      return result;
    } finally {
      await this.cleanupFiles(inputPath, outputPath);
    }
  }

  async convertToOgg(buffer: Buffer): Promise<Buffer> {
    const inputSize = buffer.length;
    this.logger.debug('Converting audio to OGG (WhatsApp PTT)', { inputSize });

    const inputPath = join(tmpdir(), `nexc-ptt-in-${randomUUID()}`);
    const outputPath = join(tmpdir(), `nexc-ptt-out-${randomUUID()}.ogg`);

    try {
      await writeFile(inputPath, buffer);

      await execFileAsync('ffmpeg', [
        '-i', inputPath,
        '-y',
        '-c:a', 'libopus',
        '-b:a', '48k',
        '-ac', '1',
        '-ar', '48000',
        '-application', 'voip',
        outputPath,
      ], { timeout: 60_000 });

      const result = await readFile(outputPath);

      this.logger.log('Audio converted to OGG PTT', {
        inputSize,
        outputSize: result.length,
      });

      return result;
    } finally {
      await this.cleanupFiles(inputPath, outputPath);
    }
  }

  private async cleanupFiles(...paths: string[]): Promise<void> {
    for (const filePath of paths) {
      try {
        await unlink(filePath);
      } catch {
        // Arquivo já removido ou inexistente, ignora
      }
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const execFileAsync = promisify(execFile);

@Injectable()
export class MediaConversionService {
  private readonly logger = new Logger(MediaConversionService.name);

  async webpToPng(buffer: Buffer): Promise<Buffer> {
    this.logger.debug('Converting WebP to PNG', { inputSize: buffer.length });

    const result = await sharp(buffer).png().toBuffer();

    this.logger.log('WebP converted to PNG', {
      inputSize: buffer.length,
      outputSize: result.length,
    });

    return result;
  }

  async audioToOgg(buffer: Buffer): Promise<Buffer> {
    this.logger.debug('Converting audio to OGG (WhatsApp PTT)', {
      inputSize: buffer.length,
    });

    const inputPath = join(tmpdir(), `nexc-conv-in-${randomUUID()}`);
    const outputPath = join(tmpdir(), `nexc-conv-out-${randomUUID()}.ogg`);

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

      this.logger.log('Audio converted to OGG', {
        inputSize: buffer.length,
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
        // Arquivo já removido ou inexistente
      }
    }
  }
}

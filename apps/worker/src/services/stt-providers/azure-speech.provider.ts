import { Injectable, Logger } from '@nestjs/common';
import { ISttProvider } from './stt-provider.interface';

@Injectable()
export class AzureSpeechProvider implements ISttProvider {
  private readonly logger = new Logger(AzureSpeechProvider.name);
  readonly name = 'azure';

  async transcribe(
    audioBuffer: Buffer,
    language: string,
  ): Promise<string> {
    this.logger.warn('Azure Speech provider is a stub, not yet implemented', {
      bufferSize: audioBuffer.length,
      language,
    });

    throw new Error(
      'Azure Speech STT provider is not yet implemented. Configure STT_PROVIDER=whisper.',
    );
  }
}

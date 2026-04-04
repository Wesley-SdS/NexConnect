import { Injectable, Logger } from '@nestjs/common';
import { MediaProcessingException } from '@nexconnect/shared';
import { ISttProvider } from './stt-provider.interface';

@Injectable()
export class AssemblyAiSttProvider implements ISttProvider {
  private readonly logger = new Logger(AssemblyAiSttProvider.name);
  readonly name = 'assemblyai';

  async transcribe(
    audioBuffer: Buffer,
    language: string,
  ): Promise<string> {
    this.logger.warn('AssemblyAI provider is a stub, not yet implemented', {
      bufferSize: audioBuffer.length,
      language,
    });

    throw new MediaProcessingException(
      'AssemblyAI STT provider is not yet implemented. Configure STT_PROVIDER=whisper.',
    );
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { MediaProcessingException } from '@nexconnect/shared';
import { ISttProvider } from './stt-providers/stt-provider.interface';
import { WhisperSttProvider } from './stt-providers/whisper.provider';
import { AssemblyAiSttProvider } from './stt-providers/assemblyai.provider';
import { AzureSpeechProvider } from './stt-providers/azure-speech.provider';

@Injectable()
export class SpeechToTextService {
  private readonly logger = new Logger(SpeechToTextService.name);
  private readonly providers: Map<string, ISttProvider>;

  constructor(
    whisper: WhisperSttProvider,
    assemblyAi: AssemblyAiSttProvider,
    azure: AzureSpeechProvider,
  ) {
    this.providers = new Map<string, ISttProvider>([
      [whisper.name, whisper],
      [assemblyAi.name, assemblyAi],
      [azure.name, azure],
    ]);
  }

  async transcribe(
    audioBuffer: Buffer,
    language: string,
    providerName: string,
  ): Promise<string> {
    const provider = this.providers.get(providerName);

    if (!provider) {
      const available = Array.from(this.providers.keys()).join(', ');
      throw new MediaProcessingException(
        `Unknown STT provider: "${providerName}". Available: ${available}`,
      );
    }

    this.logger.log('Starting transcription', {
      provider: providerName,
      language,
      bufferSize: audioBuffer.length,
    });

    const startTime = Date.now();
    const result = await provider.transcribe(audioBuffer, language);
    const durationMs = Date.now() - startTime;

    this.logger.log('Transcription completed', {
      provider: providerName,
      language,
      durationMs,
      resultLength: result.length,
    });

    return result;
  }
}

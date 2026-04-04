import { Injectable, Logger } from '@nestjs/common';
import { ISttProvider } from './stt-provider.interface';

@Injectable()
export class WhisperSttProvider implements ISttProvider {
  private readonly logger = new Logger(WhisperSttProvider.name);
  readonly name = 'whisper';

  async transcribe(
    audioBuffer: Buffer,
    language: string,
  ): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    this.logger.debug('Transcribing audio with Whisper', {
      bufferSize: audioBuffer.length,
      language,
    });

    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/ogg' });
    formData.append('file', audioBlob, 'audio.ogg');
    formData.append('model', 'whisper-1');
    formData.append('language', language);
    formData.append('response_format', 'text');

    const response = await fetch(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Whisper API error (${response.status}): ${errorBody}`,
      );
    }

    const transcription = await response.text();

    this.logger.debug('Whisper transcription completed', {
      transcriptionLength: transcription.length,
    });

    return transcription.trim();
  }
}

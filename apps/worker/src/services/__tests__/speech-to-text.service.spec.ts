import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpeechToTextService } from '../speech-to-text.service';

const mockWhisperProvider = {
  transcribe: vi.fn(),
  providerName: 'whisper',
};

const mockAssemblyProvider = {
  transcribe: vi.fn(),
  providerName: 'assemblyai',
};

describe('SpeechToTextService', () => {
  let service: SpeechToTextService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SpeechToTextService([
      mockWhisperProvider as any,
      mockAssemblyProvider as any,
    ]);
  });

  describe('transcribe', () => {
    it('should use whisper provider by default', async () => {
      mockWhisperProvider.transcribe.mockResolvedValue('Olá, tudo bem?');

      const result = await service.transcribe(
        Buffer.from('audio-data'),
        'pt-BR',
        'whisper',
      );

      expect(result).toBe('Olá, tudo bem?');
      expect(mockWhisperProvider.transcribe).toHaveBeenCalledWith(
        expect.any(Buffer),
        'pt-BR',
      );
    });

    it('should use specified provider', async () => {
      mockAssemblyProvider.transcribe.mockResolvedValue('Hello');

      const result = await service.transcribe(
        Buffer.from('audio-data'),
        'en',
        'assemblyai',
      );

      expect(result).toBe('Hello');
      expect(mockAssemblyProvider.transcribe).toHaveBeenCalled();
      expect(mockWhisperProvider.transcribe).not.toHaveBeenCalled();
    });

    it('should fallback to next provider on failure', async () => {
      mockWhisperProvider.transcribe.mockRejectedValue(new Error('API Error'));
      mockAssemblyProvider.transcribe.mockResolvedValue('Fallback transcription');

      const result = await service.transcribe(
        Buffer.from('audio-data'),
        'pt-BR',
        'whisper',
      );

      expect(result).toBe('Fallback transcription');
      expect(mockWhisperProvider.transcribe).toHaveBeenCalled();
      expect(mockAssemblyProvider.transcribe).toHaveBeenCalled();
    });

    it('should throw when all providers fail', async () => {
      mockWhisperProvider.transcribe.mockRejectedValue(new Error('Whisper Error'));
      mockAssemblyProvider.transcribe.mockRejectedValue(new Error('Assembly Error'));

      await expect(
        service.transcribe(Buffer.from('audio-data'), 'pt-BR', 'whisper'),
      ).rejects.toThrow(/all stt providers failed/i);
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaProcessingException } from '@nexconnect/shared';
import { SpeechToTextService } from '../speech-to-text.service';

const whisper = {
  name: 'whisper',
  transcribe: vi.fn(),
};

const assembly = {
  name: 'assemblyai',
  transcribe: vi.fn(),
};

const azure = {
  name: 'azure',
  transcribe: vi.fn(),
};

describe('SpeechToTextService', () => {
  let service: SpeechToTextService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SpeechToTextService(whisper as never, assembly as never, azure as never);
  });

  it('routes to the requested provider', async () => {
    whisper.transcribe.mockResolvedValue('Olá, tudo bem?');

    const result = await service.transcribe(Buffer.from('audio'), 'pt-BR', 'whisper');

    expect(result).toBe('Olá, tudo bem?');
    expect(whisper.transcribe).toHaveBeenCalledWith(expect.any(Buffer), 'pt-BR');
    expect(assembly.transcribe).not.toHaveBeenCalled();
  });

  it('routes to AssemblyAI when requested', async () => {
    assembly.transcribe.mockResolvedValue('Hello');

    const result = await service.transcribe(Buffer.from('audio'), 'en', 'assemblyai');

    expect(result).toBe('Hello');
    expect(assembly.transcribe).toHaveBeenCalled();
  });

  it('routes to Azure when requested', async () => {
    azure.transcribe.mockResolvedValue('Olá');

    const result = await service.transcribe(Buffer.from('audio'), 'pt-BR', 'azure');

    expect(result).toBe('Olá');
    expect(azure.transcribe).toHaveBeenCalled();
  });

  it('throws MediaProcessingException for unknown providers', async () => {
    await expect(
      service.transcribe(Buffer.from('audio'), 'pt-BR', 'unknown'),
    ).rejects.toBeInstanceOf(MediaProcessingException);
  });

  it('propagates errors from the underlying provider', async () => {
    whisper.transcribe.mockRejectedValue(new Error('Whisper API down'));

    await expect(
      service.transcribe(Buffer.from('audio'), 'pt-BR', 'whisper'),
    ).rejects.toThrow('Whisper API down');
  });
});

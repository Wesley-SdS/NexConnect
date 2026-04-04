import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaPreparationStage } from '../media-preparation.stage';
import {
  RateLimitExceededException,
  MediaProcessingException,
} from '@nexconnect/shared';
import type { OutboundMessage } from '../outbound-pipeline-stage.interface';

const mockRedis = {
  incrbyWithTtl: vi.fn(),
};

describe('MediaPreparationStage', () => {
  let stage: MediaPreparationStage;

  const createMessage = (overrides: Partial<OutboundMessage> = {}): OutboundMessage => ({
    messageId: 'msg-001',
    instanceId: 'ins-001',
    tenantId: 'ten-001',
    to: '+5511999998888',
    type: 'image',
    content: { url: 'https://example.com/image.png' },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    stage = new MediaPreparationStage(mockRedis as any);
  });

  it('should skip for non-media types (text)', async () => {
    const message = createMessage({ type: 'text', content: { text: 'Hello' } });

    await expect(stage.execute(message)).resolves.toBeUndefined();

    expect(mockRedis.incrbyWithTtl).not.toHaveBeenCalled();
  });

  it('should skip for non-media types (location)', async () => {
    const message = createMessage({ type: 'location', content: { lat: 0, lng: 0 } });

    await expect(stage.execute(message)).resolves.toBeUndefined();
  });

  it('should throw MediaProcessingException when media URL is missing', async () => {
    const message = createMessage({ content: {} });

    await expect(stage.execute(message)).rejects.toThrow(MediaProcessingException);
    await expect(stage.execute(message)).rejects.toThrow('Media URL is required');
  });

  it('should throw MediaProcessingException when media URL is invalid', async () => {
    const message = createMessage({ content: { url: 'not-a-url' } });

    await expect(stage.execute(message)).rejects.toThrow(MediaProcessingException);
    await expect(stage.execute(message)).rejects.toThrow('Invalid media URL');
  });

  it('should pass with valid media URL and no sizeBytes', async () => {
    const message = createMessage();

    await expect(stage.execute(message)).resolves.toBeUndefined();

    expect(mockRedis.incrbyWithTtl).not.toHaveBeenCalled();
  });

  it('should check upload rate limit when sizeBytes is provided', async () => {
    const sizeBytes = 1024 * 1024; // 1MB
    mockRedis.incrbyWithTtl.mockResolvedValue(sizeBytes);

    const message = createMessage({ content: { url: 'https://example.com/img.png', sizeBytes } });

    await expect(stage.execute(message)).resolves.toBeUndefined();

    expect(mockRedis.incrbyWithTtl).toHaveBeenCalledWith(
      `rate:media:upload:ten-001`,
      sizeBytes,
      60,
    );
  });

  it('should throw RateLimitExceededException when upload rate limit exceeded', async () => {
    const hugeSize = 100 * 1024 * 1024; // 100MB, exceeds 50MB limit
    mockRedis.incrbyWithTtl.mockResolvedValue(hugeSize);

    const message = createMessage({
      content: { url: 'https://example.com/video.mp4', sizeBytes: hugeSize },
    });

    await expect(stage.execute(message)).rejects.toThrow(
      RateLimitExceededException,
    );
  });

  it('should process all media types: image, video, audio, document, sticker', async () => {
    const mediaTypes = ['image', 'video', 'audio', 'document', 'sticker'];

    for (const type of mediaTypes) {
      const message = createMessage({ type });

      await expect(stage.execute(message)).resolves.toBeUndefined();
    }
  });
});

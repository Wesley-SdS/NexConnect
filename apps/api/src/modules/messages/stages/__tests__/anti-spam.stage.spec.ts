import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AntiSpamStage } from '../anti-spam.stage';
import { RateLimitExceededException } from '@nexconnect/shared';
import type { OutboundMessage } from '../outbound-pipeline-stage.interface';

const mockRedis = {
  incrWithTtl: vi.fn(),
};

describe('AntiSpamStage', () => {
  let stage: AntiSpamStage;

  const message: OutboundMessage = {
    messageId: 'msg-001',
    instanceId: 'ins-001',
    tenantId: 'ten-001',
    to: '+5511999998888',
    type: 'text',
    content: { text: 'Hello!' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    stage = new AntiSpamStage(mockRedis as any);
  });

  it('should allow requests under the rate limit', async () => {
    mockRedis.incrWithTtl.mockResolvedValue(5);

    await expect(stage.execute(message)).resolves.toBeUndefined();

    expect(mockRedis.incrWithTtl).toHaveBeenCalledWith(
      `antispam:${message.instanceId}:${message.to}`,
      60,
    );
  });

  it('should allow requests at exactly the limit', async () => {
    mockRedis.incrWithTtl.mockResolvedValue(30);

    await expect(stage.execute(message)).resolves.toBeUndefined();
  });

  it('should throw RateLimitExceededException when over limit', async () => {
    mockRedis.incrWithTtl.mockResolvedValue(31);

    await expect(stage.execute(message)).rejects.toThrow(
      RateLimitExceededException,
    );
  });

  it('should include count in error message when over limit', async () => {
    mockRedis.incrWithTtl.mockResolvedValue(50);

    await expect(stage.execute(message)).rejects.toThrow('50/30');
  });

  it('should use correct key format with instanceId and recipient', async () => {
    mockRedis.incrWithTtl.mockResolvedValue(1);
    const customMessage = { ...message, instanceId: 'ins-xyz', to: '+1234567890' };

    await stage.execute(customMessage);

    expect(mockRedis.incrWithTtl).toHaveBeenCalledWith(
      'antispam:ins-xyz:+1234567890',
      60,
    );
  });
});

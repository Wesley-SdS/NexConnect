import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageDeduplicationStage } from '../deduplication.stage';
import { MessageContext } from '@nexconnect/core';

const mockRedisService = {
  get: vi.fn(),
  set: vi.fn(),
};

describe('MessageDeduplicationStage', () => {
  let stage: MessageDeduplicationStage;

  beforeEach(() => {
    vi.clearAllMocks();
    stage = new MessageDeduplicationStage(mockRedisService as any);
  });

  it('should pass through new messages', async () => {
    mockRedisService.get.mockResolvedValue(null);
    mockRedisService.set.mockResolvedValue('OK');

    const context: Partial<MessageContext> = {
      rawMessage: { key: { id: 'msg_001' } },
      instanceId: 'ins_001',
      tenantId: 'ten_001',
    };

    const result = await stage.process(context as MessageContext);

    expect(result).not.toBeNull();
    expect(mockRedisService.get).toHaveBeenCalledWith('dedup:ins_001:msg_001');
    expect(mockRedisService.set).toHaveBeenCalledWith(
      'dedup:ins_001:msg_001',
      '1',
      'EX',
      3600,
    );
  });

  it('should discard duplicate messages by returning null', async () => {
    mockRedisService.get.mockResolvedValue('1');

    const context: Partial<MessageContext> = {
      rawMessage: { key: { id: 'msg_001' } },
      instanceId: 'ins_001',
      tenantId: 'ten_001',
    };

    const result = await stage.process(context as MessageContext);

    expect(result).toBeNull();
    expect(mockRedisService.set).not.toHaveBeenCalled();
  });

  it('should use correct Redis key format', async () => {
    mockRedisService.get.mockResolvedValue(null);
    mockRedisService.set.mockResolvedValue('OK');

    const context: Partial<MessageContext> = {
      rawMessage: { key: { id: 'unique_msg_id' } },
      instanceId: 'ins_abc',
      tenantId: 'ten_xyz',
    };

    await stage.process(context as MessageContext);

    expect(mockRedisService.get).toHaveBeenCalledWith('dedup:ins_abc:unique_msg_id');
  });
});

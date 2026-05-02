import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageDeduplicationStage } from '../deduplication.stage';
import { MessageContext } from '@nexconnect/core';

const mockRedisService = {
  get: vi.fn(),
  set: vi.fn(),
};

const DEDUP_TTL_SECONDS = 3600;

const buildContext = (overrides: Partial<MessageContext> = {}): MessageContext =>
  ({
    id: 'msg_001',
    instanceId: 'ins_001',
    tenantId: 'ten_001',
    rawMessage: { key: { id: 'msg_001' } },
    ...overrides,
  }) as unknown as MessageContext;

describe('MessageDeduplicationStage', () => {
  let stage: MessageDeduplicationStage;

  beforeEach(() => {
    vi.clearAllMocks();
    stage = new MessageDeduplicationStage(mockRedisService as never);
  });

  it('passes through new messages and writes the dedup key with TTL', async () => {
    mockRedisService.get.mockResolvedValue(null);
    mockRedisService.set.mockResolvedValue(undefined);

    const context = buildContext();
    const result = await stage.execute(context);

    expect(result).toBe(context);
    expect(mockRedisService.get).toHaveBeenCalledWith('dedup:msg:ins_001:msg_001');
    expect(mockRedisService.set).toHaveBeenCalledWith(
      'dedup:msg:ins_001:msg_001',
      '1',
      DEDUP_TTL_SECONDS,
    );
  });

  it('returns null when the message id is already known', async () => {
    mockRedisService.get.mockResolvedValue('1');

    const result = await stage.execute(buildContext());

    expect(result).toBeNull();
    expect(mockRedisService.set).not.toHaveBeenCalled();
  });

  it('namespaces the dedup key by instanceId and provider message id', async () => {
    mockRedisService.get.mockResolvedValue(null);

    await stage.execute(
      buildContext({
        instanceId: 'ins_abc',
        rawMessage: { key: { id: 'unique_msg_id' } } as never,
      }),
    );

    expect(mockRedisService.get).toHaveBeenCalledWith('dedup:msg:ins_abc:unique_msg_id');
  });
});

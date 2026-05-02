import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageContext } from '@nexconnect/core';
import { MessageEnrichmentStage } from '../enrichment.stage';

const mockPrisma = {
  $queryRaw: vi.fn(),
};

const buildContext = (overrides: Partial<MessageContext> = {}): MessageContext =>
  ({
    id: overrides.id ?? 'msg-1',
    instanceId: overrides.instanceId ?? 'ins-1',
    tenantId: overrides.tenantId ?? null,
    rawMessage: overrides.rawMessage ?? {
      key: { id: 'wamid', remoteJid: '5511999998888@s.whatsapp.net' },
      pushName: 'Wesley',
    },
    ...overrides,
  }) as unknown as MessageContext;

describe('MessageEnrichmentStage', () => {
  let stage: MessageEnrichmentStage;

  beforeEach(() => {
    vi.clearAllMocks();
    stage = new MessageEnrichmentStage(mockPrisma as never);
  });

  it('enriches the context with profileName, normalizedPhone, isGroup, and tenantId', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ tenant_id: 'ten-1' }]);

    const result = await stage.execute(buildContext());

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      isGroup: false,
      normalizedPhone: '5511999998888',
      profileName: 'Wesley',
      tenantId: 'ten-1',
      bufferedMessagesCount: 1,
    });
  });

  it('detects group messages by @g.us suffix', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ tenant_id: 'ten-1' }]);

    const result = await stage.execute(
      buildContext({
        rawMessage: {
          key: { id: 'wamid-group', remoteJid: '120363001234@g.us' },
          pushName: 'Wesley',
        } as never,
      }),
    );

    expect(result).not.toBeNull();
    expect(result!.isGroup).toBe(true);
    expect(result!.normalizedPhone).toBe('120363001234');
  });

  it('returns the context unchanged when remoteJid is missing', async () => {
    const ctx = buildContext({
      rawMessage: { key: { id: 'wamid' }, pushName: null } as never,
    });

    const result = await stage.execute(ctx);

    expect(result).toBe(ctx);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('falls back to a null tenantId when the lookup fails', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('db down'));

    const result = await stage.execute(buildContext());

    expect(result).not.toBeNull();
    expect(result!.tenantId).toBeNull();
  });

  it('preserves an existing bufferedMessagesCount', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ tenant_id: 'ten-1' }]);

    const result = await stage.execute(
      buildContext({ bufferedMessagesCount: 5 } as never),
    );

    expect(result!.bufferedMessagesCount).toBe(5);
  });
});

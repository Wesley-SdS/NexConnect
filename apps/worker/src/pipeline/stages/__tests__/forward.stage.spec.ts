import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageContext, WebhookEvent } from '@nexconnect/core';
import { WebhookForwardStage } from '../forward.stage';

const mockPrisma = {
  $queryRaw: vi.fn(),
};

const mockWebhookQueue = {
  add: vi.fn(),
};

const buildContext = (overrides: Partial<MessageContext> = {}): MessageContext =>
  ({
    id: 'msg-1',
    instanceId: 'ins-1',
    tenantId: 'ten-1',
    messageType: 'TEXT',
    rawMessage: {
      key: { id: 'wamid', remoteJid: '5511999@s.whatsapp.net' },
    },
    normalizedPhone: '5511999',
    profileName: 'Wesley',
    bufferedText: 'Hello',
    isGroup: false,
    bufferedMessagesCount: 1,
    ...overrides,
  }) as unknown as MessageContext;

describe('WebhookForwardStage', () => {
  let stage: WebhookForwardStage;

  beforeEach(() => {
    vi.clearAllMocks();
    stage = new WebhookForwardStage(mockPrisma as never, mockWebhookQueue as never);
  });

  it('passes through unchanged when no webhook configs exist', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const context = buildContext();
    const result = await stage.execute(context);

    expect(result).toBe(context);
    expect(mockWebhookQueue.add).not.toHaveBeenCalled();
  });

  it('builds the normalized payload and enqueues a delivery job per webhook', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { url: 'https://hook-a.example.com', secret: 'secret-a' },
      { url: 'https://hook-b.example.com', secret: 'secret-b' },
    ]);

    await stage.execute(buildContext());

    expect(mockWebhookQueue.add).toHaveBeenCalledTimes(2);
    const firstCall = mockWebhookQueue.add.mock.calls[0];
    expect(firstCall[0]).toBe('deliver');
    expect(firstCall[1]).toMatchObject({
      url: 'https://hook-a.example.com',
      instanceId: 'ins-1',
      messageId: 'msg-1',
      attempt: 0,
    });
    expect(firstCall[1].signature).toEqual(expect.any(String));
    const parsedPayload = JSON.parse(firstCall[1].payload);
    expect(parsedPayload).toMatchObject({
      event: WebhookEvent.MESSAGE_RECEIVED,
      instance_id: 'ins-1',
      data: expect.objectContaining({
        message_id: 'msg-1',
        from: '5511999@s.whatsapp.net',
        phone: '5511999',
        profile_name: 'Wesley',
        text: 'Hello',
        is_group: false,
      }),
    });
  });

  it('returns the context unchanged when the DB query throws', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('boom'));

    const context = buildContext();
    const result = await stage.execute(context);

    expect(result).toBe(context);
    expect(mockWebhookQueue.add).not.toHaveBeenCalled();
  });

  it('configures retry policy on the delivery job', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ url: 'https://h', secret: 's' }]);

    await stage.execute(buildContext());

    const opts = mockWebhookQueue.add.mock.calls[0][2];
    expect(opts).toMatchObject({
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
    });
  });
});

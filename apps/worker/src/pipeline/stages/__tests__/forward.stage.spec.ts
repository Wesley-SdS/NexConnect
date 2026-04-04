import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookForwardStage } from '../forward.stage';
import { MessageContext, MessageType, WebhookEvent } from '@nexconnect/core';

const mockPrismaService = {
  webhook: {
    findMany: vi.fn(),
  },
  event: {
    create: vi.fn(),
  },
};

const mockWebhookQueue = {
  add: vi.fn(),
};

describe('WebhookForwardStage', () => {
  let stage: WebhookForwardStage;

  beforeEach(() => {
    vi.clearAllMocks();
    stage = new WebhookForwardStage(
      mockPrismaService as any,
      mockWebhookQueue as any,
    );
  });

  it('should build normalized payload and enqueue delivery', async () => {
    mockPrismaService.webhook.findMany.mockResolvedValue([
      {
        id: 'wh_001',
        url: 'https://nexbot.app/webhook',
        events: [WebhookEvent.MESSAGE_RECEIVED],
        enabled: true,
        secretEncrypted: 'encrypted_secret',
        retryMaxAttempts: 5,
        retryBackoffBase: 2.5,
      },
    ]);
    mockPrismaService.event.create.mockResolvedValue({ id: 'evt_001' });

    const context: Partial<MessageContext> = {
      instanceId: 'ins_001',
      tenantId: 'ten_001',
      messageType: MessageType.TEXT,
      processedContent: { text: 'Hello world' },
      metadata: {
        fromName: 'João',
        fromPhone: '+5511999998888',
        isGroup: false,
        bufferedMessages: 1,
      },
      timestamps: {
        receivedAt: new Date('2026-03-30T12:00:00Z'),
      },
    };

    const result = await stage.process(context as MessageContext);

    expect(result).not.toBeNull();
    expect(mockPrismaService.event.create).toHaveBeenCalled();
    expect(mockWebhookQueue.add).toHaveBeenCalledWith(
      'webhook-delivery',
      expect.objectContaining({
        webhookId: 'wh_001',
        eventId: 'evt_001',
      }),
      expect.any(Object),
    );
  });

  it('should skip delivery when no webhooks match event', async () => {
    mockPrismaService.webhook.findMany.mockResolvedValue([]);

    const context: Partial<MessageContext> = {
      instanceId: 'ins_001',
      tenantId: 'ten_001',
      messageType: MessageType.TEXT,
      processedContent: { text: 'Hello' },
      metadata: { fromPhone: '+5511999998888', isGroup: false },
      timestamps: { receivedAt: new Date() },
    };

    const result = await stage.process(context as MessageContext);

    expect(result).not.toBeNull();
    expect(mockWebhookQueue.add).not.toHaveBeenCalled();
  });

  it('should skip disabled webhooks', async () => {
    mockPrismaService.webhook.findMany.mockResolvedValue([
      {
        id: 'wh_001',
        url: 'https://disabled.webhook.com',
        events: [WebhookEvent.MESSAGE_RECEIVED],
        enabled: false,
      },
    ]);

    const context: Partial<MessageContext> = {
      instanceId: 'ins_001',
      tenantId: 'ten_001',
      messageType: MessageType.TEXT,
      processedContent: { text: 'test' },
      metadata: { fromPhone: '+5511999998888', isGroup: false },
      timestamps: { receivedAt: new Date() },
    };

    await stage.process(context as MessageContext);

    expect(mockWebhookQueue.add).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookDispatchService } from '../webhook-dispatch.service';
import { CryptoUtil } from '@nexconnect/shared';
import { WebhookEvent } from '@nexconnect/core';

vi.mock('@nexconnect/shared', async () => {
  const actual = await vi.importActual<typeof import('@nexconnect/shared')>(
    '@nexconnect/shared',
  );
  return {
    ...actual,
    CryptoUtil: {
      ...actual.CryptoUtil,
      generateHmacSignature: vi.fn().mockReturnValue('mocked_hmac_signature'),
    },
  };
});

const mockPrismaService = {
  webhook: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  event: {
    create: vi.fn(),
  },
};

const mockDispatchQueue = {
  add: vi.fn(),
};

const mockRedisService = {
  incrWithTtl: vi.fn().mockResolvedValue(1),
};

describe('WebhookDispatchService', () => {
  let service: WebhookDispatchService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisService.incrWithTtl.mockResolvedValue(1);
    service = new WebhookDispatchService(
      mockPrismaService as any,
      mockRedisService as any,
      mockDispatchQueue as any,
    );
  });

  describe('buildPayload', () => {
    it('should build correct webhook payload with all required fields', () => {
      const payload = service.buildPayload(
        WebhookEvent.MESSAGE_RECEIVED,
        'ins_001',
        'ten_001',
        {
          message_id: 'msg_001',
          type: 'text',
          from: '+5511999998888',
          content: { text: 'Hello' },
        },
      );

      expect(payload).toHaveProperty('id');
      expect(payload.type).toBe(WebhookEvent.MESSAGE_RECEIVED);
      expect(payload.instance_id).toBe('ins_001');
      expect(payload.tenant_id).toBe('ten_001');
      expect(payload.created_at).toBeDefined();
      expect(payload.data).toEqual(
        expect.objectContaining({
          message_id: 'msg_001',
          type: 'text',
        }),
      );
      expect(payload.meta).toEqual({
        delivery_attempt: 1,
        replay: false,
      });
    });

    it('should respect custom meta values', () => {
      const payload = service.buildPayload(
        WebhookEvent.MESSAGE_RECEIVED,
        'ins_001',
        'ten_001',
        {},
        { delivery_attempt: 3, replay: true },
      );

      expect(payload.meta.delivery_attempt).toBe(3);
      expect(payload.meta.replay).toBe(true);
    });
  });

  describe('buildHeaders', () => {
    it('should include all required security headers', () => {
      const payload = service.buildPayload(
        WebhookEvent.MESSAGE_RECEIVED,
        'ins_001',
        'ten_001',
        { message_id: 'msg_001' },
      );

      const headers = service.buildHeaders(payload, 'test_secret');

      expect(headers['X-NexConnect-Signature']).toBe(
        'sha256=mocked_hmac_signature',
      );
      expect(headers['X-NexConnect-Event']).toBe(
        WebhookEvent.MESSAGE_RECEIVED,
      );
      expect(headers['X-NexConnect-Delivery-Id']).toBe(payload.id);
      expect(headers['X-NexConnect-Timestamp']).toBe(payload.created_at);
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['User-Agent']).toBe('NexConnect-Webhook/1.0');
    });

    it('should call CryptoUtil.generateHmacSignature with payload and secret', () => {
      const payload = service.buildPayload(
        WebhookEvent.MESSAGE_SENT,
        'ins_001',
        'ten_001',
        {},
      );

      service.buildHeaders(payload, 'my_secret');

      expect(CryptoUtil.generateHmacSignature).toHaveBeenCalledWith(
        JSON.stringify(payload),
        'my_secret',
      );
    });
  });

  describe('dispatch', () => {
    it('should skip dispatch for inactive webhooks', async () => {
      mockPrismaService.webhook.findUnique.mockResolvedValue({
        id: 'wh_001',
        enabled: false,
        events: [],
        url: 'https://example.com/hook',
      });

      const payload = service.buildPayload(
        WebhookEvent.MESSAGE_RECEIVED,
        'ins_001',
        'ten_001',
        {},
      );

      await service.dispatch('wh_001', payload);

      expect(mockPrismaService.event.create).not.toHaveBeenCalled();
      expect(mockDispatchQueue.add).not.toHaveBeenCalled();
    });

    it('should skip dispatch for non-existent webhooks', async () => {
      mockPrismaService.webhook.findUnique.mockResolvedValue(null);

      const payload = service.buildPayload(
        WebhookEvent.MESSAGE_RECEIVED,
        'ins_001',
        'ten_001',
        {},
      );

      await service.dispatch('wh_nonexistent', payload);

      expect(mockPrismaService.event.create).not.toHaveBeenCalled();
      expect(mockDispatchQueue.add).not.toHaveBeenCalled();
    });

    it('should filter events that do not match webhook subscription', async () => {
      mockPrismaService.webhook.findUnique.mockResolvedValue({
        id: 'wh_001',
        enabled: true,
        events: [WebhookEvent.MESSAGE_SENT],
        url: 'https://example.com/hook',
        secretEncrypted: null,
        retryMaxAttempts: 3,
        retryBackoffBase: 1,
        testMode: false,
        testUrl: null,
      });

      const payload = service.buildPayload(
        WebhookEvent.MESSAGE_RECEIVED,
        'ins_001',
        'ten_001',
        {},
      );

      await service.dispatch('wh_001', payload);

      expect(mockPrismaService.event.create).not.toHaveBeenCalled();
      expect(mockDispatchQueue.add).not.toHaveBeenCalled();
    });

    it('should persist event BEFORE enqueuing job', async () => {
      const callOrder: string[] = [];

      mockPrismaService.webhook.findUnique.mockResolvedValue({
        id: 'wh_001',
        enabled: true,
        events: [],
        url: 'https://example.com/hook',
        secretEncrypted: 'secret123',
        retryMaxAttempts: 3,
        retryBackoffBase: 1,
        testMode: false,
        testUrl: null,
      });

      mockPrismaService.event.create.mockImplementation(async () => {
        callOrder.push('event.create');
        return {};
      });

      mockDispatchQueue.add.mockImplementation(async () => {
        callOrder.push('queue.add');
        return {};
      });

      const payload = service.buildPayload(
        WebhookEvent.MESSAGE_RECEIVED,
        'ins_001',
        'ten_001',
        { message_id: 'msg_001' },
      );

      await service.dispatch('wh_001', payload);

      expect(callOrder).toEqual(['event.create', 'queue.add']);
      expect(mockPrismaService.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: payload.id,
          tenantId: 'ten_001',
          instanceId: 'ins_001',
          type: WebhookEvent.MESSAGE_RECEIVED,
          payload: expect.any(Object),
        }),
      });
    });

    it('should dispatch matching events to queue', async () => {
      mockPrismaService.webhook.findUnique.mockResolvedValue({
        id: 'wh_001',
        enabled: true,
        events: [WebhookEvent.MESSAGE_RECEIVED],
        url: 'https://example.com/hook',
        secretEncrypted: 'secret123',
        retryMaxAttempts: 5,
        retryBackoffBase: 2,
        testMode: false,
        testUrl: null,
      });

      mockPrismaService.event.create.mockResolvedValue({});

      const payload = service.buildPayload(
        WebhookEvent.MESSAGE_RECEIVED,
        'ins_001',
        'ten_001',
        {},
      );

      await service.dispatch('wh_001', payload);

      expect(mockDispatchQueue.add).toHaveBeenCalledWith(
        'deliver',
        expect.objectContaining({
          eventId: payload.id,
          webhookId: 'wh_001',
          url: 'https://example.com/hook',
          payload,
          attempt: 1,
        }),
        expect.objectContaining({
          jobId: payload.id,
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
        }),
      );
    });

    it('should use testUrl when testMode is enabled', async () => {
      mockPrismaService.webhook.findUnique.mockResolvedValue({
        id: 'wh_001',
        enabled: true,
        events: [],
        url: 'https://example.com/hook',
        secretEncrypted: null,
        retryMaxAttempts: 3,
        retryBackoffBase: 1,
        testMode: true,
        testUrl: 'https://test.example.com/hook',
      });

      mockPrismaService.event.create.mockResolvedValue({});

      const payload = service.buildPayload(
        WebhookEvent.MESSAGE_RECEIVED,
        'ins_001',
        'ten_001',
        {},
      );

      await service.dispatch('wh_001', payload);

      expect(mockDispatchQueue.add).toHaveBeenCalledWith(
        'deliver',
        expect.objectContaining({
          url: 'https://test.example.com/hook',
        }),
        expect.any(Object),
      );
    });
  });

  describe('dispatchToInstance', () => {
    it('should dispatch to all enabled webhooks for instance', async () => {
      mockPrismaService.webhook.findMany.mockResolvedValue([
        {
          id: 'wh_001',
          enabled: true,
          events: [],
          url: 'https://hook1.com',
          secretEncrypted: null,
          retryMaxAttempts: 3,
          retryBackoffBase: 1,
          testMode: false,
          testUrl: null,
        },
        {
          id: 'wh_002',
          enabled: true,
          events: [],
          url: 'https://hook2.com',
          secretEncrypted: null,
          retryMaxAttempts: 3,
          retryBackoffBase: 1,
          testMode: false,
          testUrl: null,
        },
      ]);

      mockPrismaService.webhook.findUnique
        .mockResolvedValueOnce({
          id: 'wh_001',
          enabled: true,
          events: [],
          url: 'https://hook1.com',
          secretEncrypted: null,
          retryMaxAttempts: 3,
          retryBackoffBase: 1,
          testMode: false,
          testUrl: null,
        })
        .mockResolvedValueOnce({
          id: 'wh_002',
          enabled: true,
          events: [],
          url: 'https://hook2.com',
          secretEncrypted: null,
          retryMaxAttempts: 3,
          retryBackoffBase: 1,
          testMode: false,
          testUrl: null,
        });

      mockPrismaService.event.create.mockResolvedValue({});

      const payload = service.buildPayload(
        WebhookEvent.MESSAGE_RECEIVED,
        'ins_001',
        'ten_001',
        {},
      );

      await service.dispatchToInstance('ins_001', payload);

      expect(mockPrismaService.webhook.findMany).toHaveBeenCalledWith({
        where: { instanceId: 'ins_001', enabled: true },
      });
      expect(mockDispatchQueue.add).toHaveBeenCalledTimes(2);
    });
  });
});

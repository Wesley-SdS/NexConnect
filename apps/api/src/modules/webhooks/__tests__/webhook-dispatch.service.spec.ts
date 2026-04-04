import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookDispatchService } from '../webhook-dispatch.service';

const mockPrismaService = {
  webhookDelivery: {
    create: vi.fn(),
    update: vi.fn(),
  },
  webhook: {
    findUnique: vi.fn(),
  },
};

describe('WebhookDispatchService', () => {
  let service: WebhookDispatchService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WebhookDispatchService(mockPrismaService as any);
  });

  describe('buildPayload', () => {
    it('should build correct webhook payload structure', () => {
      const payload = service.buildPayload({
        eventId: 'evt_001',
        eventType: 'message.received',
        instanceId: 'ins_001',
        tenantId: 'ten_001',
        data: {
          message_id: 'msg_001',
          type: 'text',
          from: '+5511999998888',
          content: { text: 'Hello' },
        },
      });

      expect(payload).toMatchObject({
        id: 'evt_001',
        type: 'message.received',
        instance_id: 'ins_001',
        tenant_id: 'ten_001',
        data: expect.objectContaining({
          message_id: 'msg_001',
          type: 'text',
        }),
        meta: {
          delivery_attempt: 1,
          replay: false,
        },
      });
      expect(payload.created_at).toBeDefined();
    });
  });

  describe('buildHeaders', () => {
    it('should include all required security headers', () => {
      const headers = service.buildHeaders({
        eventType: 'message.received',
        deliveryId: 'del_001',
        signature: 'abc123',
        customHeaders: {},
      });

      expect(headers['X-NexConnect-Signature']).toBe('sha256=abc123');
      expect(headers['X-NexConnect-Event']).toBe('message.received');
      expect(headers['X-NexConnect-Delivery-Id']).toBe('del_001');
      expect(headers['X-NexConnect-Timestamp']).toBeDefined();
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should merge custom headers', () => {
      const headers = service.buildHeaders({
        eventType: 'message.received',
        deliveryId: 'del_001',
        signature: 'abc123',
        customHeaders: { Authorization: 'Bearer token123' },
      });

      expect(headers['Authorization']).toBe('Bearer token123');
    });
  });
});

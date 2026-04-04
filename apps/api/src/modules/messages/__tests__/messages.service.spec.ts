import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessagesService } from '../messages.service';
import { InstanceOfflineException, InvalidPhoneNumberException } from '@nexconnect/shared';

const mockPrismaService = {
  instance: {
    findUnique: vi.fn(),
  },
  message: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
};

const mockRedisService = {
  get: vi.fn(),
  set: vi.fn(),
  incr: vi.fn(),
};

const mockOutboundQueue = {
  add: vi.fn(),
};

describe('MessagesService', () => {
  let service: MessagesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MessagesService(
      mockPrismaService as any,
      mockRedisService as any,
      mockOutboundQueue as any,
    );
  });

  describe('send', () => {
    it('should validate instance is connected before sending', async () => {
      mockPrismaService.instance.findUnique.mockResolvedValue({
        id: 'ins_001',
        tenantId: 'ten_001',
        status: 'DISCONNECTED',
      });

      await expect(
        service.send('ins_001', 'ten_001', {
          to: '+5511999998888',
          type: 'text',
          content: { text: 'Hello' },
        }),
      ).rejects.toThrow(InstanceOfflineException);
    });

    it('should validate phone number format', async () => {
      mockPrismaService.instance.findUnique.mockResolvedValue({
        id: 'ins_001',
        tenantId: 'ten_001',
        status: 'CONNECTED',
      });

      await expect(
        service.send('ins_001', 'ten_001', {
          to: 'invalid',
          type: 'text',
          content: { text: 'Hello' },
        }),
      ).rejects.toThrow(InvalidPhoneNumberException);
    });

    it('should create message and enqueue for delivery', async () => {
      mockPrismaService.instance.findUnique.mockResolvedValue({
        id: 'ins_001',
        tenantId: 'ten_001',
        status: 'CONNECTED',
        settings: { rateLimitPerMinute: 100 },
      });
      mockRedisService.incr.mockResolvedValue(1);
      mockPrismaService.message.create.mockResolvedValue({
        id: 'msg_new',
        status: 'PENDING',
      });

      const result = await service.send('ins_001', 'ten_001', {
        to: '+5511999998888',
        type: 'text',
        content: { text: 'Hello!' },
      });

      expect(result.id).toBe('msg_new');
      expect(mockOutboundQueue.add).toHaveBeenCalledWith(
        'outbound-message',
        expect.objectContaining({ messageId: 'msg_new' }),
        expect.any(Object),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated messages', async () => {
      mockPrismaService.message.findMany.mockResolvedValue([
        { id: 'msg_001', type: 'text', direction: 'INBOUND' },
      ]);
      mockPrismaService.message.count.mockResolvedValue(1);

      const result = await service.findAll('ins_001', 'ten_001', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});

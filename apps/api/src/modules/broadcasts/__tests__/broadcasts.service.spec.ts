import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BroadcastsService, BroadcastVariant } from '../broadcasts.service';

const mockPrisma = {
  broadcast: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
};

const mockInstancesService = {
  findOne: vi.fn(),
};

const mockStrategy = {
  selectInstance: vi.fn(),
};

const mockStrategyFactory = {
  getStrategy: vi.fn().mockReturnValue(mockStrategy),
};

const mockBroadcastQueue = {
  add: vi.fn(),
  getJobs: vi.fn(),
};

describe('BroadcastsService', () => {
  let service: BroadcastsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStrategy.selectInstance.mockImplementation(
      (ids: string[], index: number) => Promise.resolve(ids[index % ids.length]),
    );
    service = new BroadcastsService(
      mockPrisma as any,
      mockInstancesService as any,
      mockStrategyFactory as any,
      mockBroadcastQueue as any,
    );
  });

  describe('create', () => {
    const validData = {
      instanceIds: ['ins-001'],
      recipients: ['+5511999998888'],
      type: 'text',
      content: { text: 'Hello!' },
    };

    it('should create a broadcast with valid data', async () => {
      mockInstancesService.findOne.mockResolvedValue({ id: 'ins-001' });
      mockPrisma.broadcast.create.mockResolvedValue({
        id: 'broadcast-001',
        ...validData,
        status: 'queued',
      });

      const result = await service.create('ten-001', validData);

      expect(mockInstancesService.findOne).toHaveBeenCalledWith('ten-001', 'ins-001');
      expect(mockPrisma.broadcast.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'ten-001',
            type: 'text',
            status: 'queued',
          }),
        }),
      );
      expect(mockBroadcastQueue.add).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
    });

    it('should validate all provided instance IDs exist', async () => {
      const multiInstanceData = {
        ...validData,
        instanceIds: ['ins-001', 'ins-002'],
      };

      mockInstancesService.findOne.mockResolvedValue({ id: 'ins-001' });
      mockPrisma.broadcast.create.mockResolvedValue({ id: 'broadcast-001' });

      await service.create('ten-001', multiInstanceData);

      expect(mockInstancesService.findOne).toHaveBeenCalledWith('ten-001', 'ins-001');
      expect(mockInstancesService.findOne).toHaveBeenCalledWith('ten-001', 'ins-002');
    });

    it('should throw BadRequestException when instanceIds is empty', async () => {
      await expect(
        service.create('ten-001', { ...validData, instanceIds: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when recipients is empty', async () => {
      await expect(
        service.create('ten-001', { ...validData, recipients: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should queue one job per recipient with correct delay', async () => {
      const data = {
        ...validData,
        recipients: ['+5511111111111', '+5522222222222', '+5533333333333'],
        delayBetweenMs: 1000,
      };

      mockInstancesService.findOne.mockResolvedValue({ id: 'ins-001' });
      mockPrisma.broadcast.create.mockResolvedValue({ id: 'broadcast-001' });

      await service.create('ten-001', data);

      expect(mockBroadcastQueue.add).toHaveBeenCalledTimes(3);
      expect(mockBroadcastQueue.add).toHaveBeenCalledWith(
        'send-broadcast-message',
        expect.objectContaining({ to: '+5511111111111', index: 0 }),
        expect.objectContaining({ delay: 0 }),
      );
      expect(mockBroadcastQueue.add).toHaveBeenCalledWith(
        'send-broadcast-message',
        expect.objectContaining({ to: '+5522222222222', index: 1 }),
        expect.objectContaining({ delay: 1000 }),
      );
      expect(mockBroadcastQueue.add).toHaveBeenCalledWith(
        'send-broadcast-message',
        expect.objectContaining({ to: '+5533333333333', index: 2 }),
        expect.objectContaining({ delay: 2000 }),
      );
    });
  });

  describe('variant validation', () => {
    const baseData = {
      instanceIds: ['ins-001'],
      recipients: ['+5511999998888'],
      type: 'text',
      content: { text: 'Hello!' },
    };

    it('should throw when fewer than 2 variants', async () => {
      const variants: BroadcastVariant[] = [
        { name: 'A', content: { text: 'Hi' }, weight: 100 },
      ];

      await expect(
        service.create('ten-001', { ...baseData, variants }),
      ).rejects.toThrow('at least 2 variants');
    });

    it('should throw when variant weights do not sum to 100', async () => {
      const variants: BroadcastVariant[] = [
        { name: 'A', content: { text: 'Hi' }, weight: 60 },
        { name: 'B', content: { text: 'Hey' }, weight: 60 },
      ];

      await expect(
        service.create('ten-001', { ...baseData, variants }),
      ).rejects.toThrow('weights must sum to 100');
    });

    it('should throw when variant names are not unique', async () => {
      const variants: BroadcastVariant[] = [
        { name: 'A', content: { text: 'Hi' }, weight: 50 },
        { name: 'A', content: { text: 'Hey' }, weight: 50 },
      ];

      await expect(
        service.create('ten-001', { ...baseData, variants }),
      ).rejects.toThrow('unique');
    });

    it('should accept valid variants', async () => {
      const variants: BroadcastVariant[] = [
        { name: 'A', content: { text: 'Hi' }, weight: 50 },
        { name: 'B', content: { text: 'Hey' }, weight: 50 },
      ];

      mockInstancesService.findOne.mockResolvedValue({ id: 'ins-001' });
      mockPrisma.broadcast.create.mockResolvedValue({ id: 'broadcast-001' });

      await expect(
        service.create('ten-001', { ...baseData, variants }),
      ).resolves.toBeDefined();
    });
  });

  describe('getVariantForRecipient', () => {
    it('should distribute based on weight', () => {
      const variants: BroadcastVariant[] = [
        { name: 'A', content: { text: 'Hi' }, weight: 70 },
        { name: 'B', content: { text: 'Hey' }, weight: 30 },
      ];

      // indices 0-69 map to A (weight 70), 70-99 to B (weight 30)
      expect(service.getVariantForRecipient(variants, 0).name).toBe('A');
      expect(service.getVariantForRecipient(variants, 69).name).toBe('A');
      expect(service.getVariantForRecipient(variants, 70).name).toBe('B');
      expect(service.getVariantForRecipient(variants, 99).name).toBe('B');
    });

    it('should wrap around for indices beyond total weight', () => {
      const variants: BroadcastVariant[] = [
        { name: 'A', content: { text: 'Hi' }, weight: 50 },
        { name: 'B', content: { text: 'Hey' }, weight: 50 },
      ];

      // index 100 % 100 = 0 -> A, index 150 % 100 = 50 -> B
      expect(service.getVariantForRecipient(variants, 100).name).toBe('A');
      expect(service.getVariantForRecipient(variants, 150).name).toBe('B');
    });
  });

  describe('findAll', () => {
    it('should return paginated broadcasts', async () => {
      const broadcasts = [{ id: 'b-001' }, { id: 'b-002' }];
      mockPrisma.broadcast.findMany.mockResolvedValue(broadcasts);
      mockPrisma.broadcast.count.mockResolvedValue(50);

      const result = await service.findAll('ten-001', 1, 20);

      expect(result.broadcasts).toEqual(broadcasts);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 50,
        totalPages: 3,
      });
    });

    it('should cap limit at 100', async () => {
      mockPrisma.broadcast.findMany.mockResolvedValue([]);
      mockPrisma.broadcast.count.mockResolvedValue(0);

      await service.findAll('ten-001', 1, 500);

      expect(mockPrisma.broadcast.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should compute correct skip offset', async () => {
      mockPrisma.broadcast.findMany.mockResolvedValue([]);
      mockPrisma.broadcast.count.mockResolvedValue(0);

      await service.findAll('ten-001', 3, 10);

      expect(mockPrisma.broadcast.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20 }),
      );
    });
  });

  describe('findOne', () => {
    it('should return broadcast when found', async () => {
      const broadcast = { id: 'b-001', tenantId: 'ten-001' };
      mockPrisma.broadcast.findFirst.mockResolvedValue(broadcast);

      const result = await service.findOne('ten-001', 'b-001');

      expect(result).toEqual(broadcast);
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.broadcast.findFirst.mockResolvedValue(null);

      await expect(service.findOne('ten-001', 'b-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    it('should pause broadcast and remove pending jobs', async () => {
      mockPrisma.broadcast.findFirst.mockResolvedValue({
        id: 'b-001',
        status: 'active',
      });
      const mockJob = { data: { broadcastId: 'b-001' }, remove: vi.fn() };
      mockBroadcastQueue.getJobs.mockResolvedValue([mockJob]);
      mockPrisma.broadcast.update.mockResolvedValue({ id: 'b-001', status: 'paused' });

      await service.updateStatus('ten-001', 'b-001', 'paused');

      expect(mockBroadcastQueue.getJobs).toHaveBeenCalledWith(['delayed', 'waiting']);
      expect(mockJob.remove).toHaveBeenCalled();
      expect(mockPrisma.broadcast.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'paused' },
        }),
      );
    });

    it('should not allow changing status of a completed broadcast', async () => {
      mockPrisma.broadcast.findFirst.mockResolvedValue({
        id: 'b-001',
        status: 'completed',
      });

      await expect(
        service.updateStatus('ten-001', 'b-001', 'active'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not allow changing status of a cancelled broadcast', async () => {
      mockPrisma.broadcast.findFirst.mockResolvedValue({
        id: 'b-001',
        status: 'cancelled',
      });

      await expect(
        service.updateStatus('ten-001', 'b-001', 'paused'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should resume a paused broadcast', async () => {
      mockPrisma.broadcast.findFirst.mockResolvedValue({
        id: 'b-001',
        status: 'paused',
      });
      mockPrisma.broadcast.update.mockResolvedValue({ id: 'b-001', status: 'active' });

      await service.updateStatus('ten-001', 'b-001', 'active');

      expect(mockPrisma.broadcast.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'active' },
        }),
      );
    });
  });
});

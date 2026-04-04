import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InstancesService } from '../instances.service';
import { InstanceNotFoundException } from '@nexconnect/shared';

const mockPrismaService = {
  instance: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
};

const mockRedisService = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  publish: vi.fn(),
};

const mockInstanceQueue = {
  add: vi.fn(),
};

describe('InstancesService', () => {
  let service: InstancesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InstancesService(
      mockPrismaService as any,
      mockRedisService as any,
      mockInstanceQueue as any,
    );
  });

  describe('findAll', () => {
    it('should return paginated instances for tenant', async () => {
      const instances = [
        { id: 'ins_001', name: 'Instance 1', status: 'CONNECTED' },
        { id: 'ins_002', name: 'Instance 2', status: 'DISCONNECTED' },
      ];
      mockPrismaService.instance.findMany.mockResolvedValue(instances);
      mockPrismaService.instance.count.mockResolvedValue(2);

      const result = await service.findAll('ten_001', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockPrismaService.instance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'ten_001' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return instance by id', async () => {
      mockPrismaService.instance.findUnique.mockResolvedValue({
        id: 'ins_001',
        tenantId: 'ten_001',
        name: 'My Instance',
      });

      const result = await service.findOne('ins_001', 'ten_001');

      expect(result.id).toBe('ins_001');
    });

    it('should throw InstanceNotFoundException when not found', async () => {
      mockPrismaService.instance.findUnique.mockResolvedValue(null);

      await expect(service.findOne('ins_999', 'ten_001')).rejects.toThrow(
        InstanceNotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create instance and enqueue connection', async () => {
      mockPrismaService.instance.create.mockResolvedValue({
        id: 'ins_new',
        name: 'New Instance',
        status: 'CREATED',
        tenantId: 'ten_001',
      });

      const result = await service.create('ten_001', {
        name: 'New Instance',
        connectionType: 'QR_CODE',
      });

      expect(result.id).toBe('ins_new');
      expect(mockPrismaService.instance.create).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete instance and disconnect', async () => {
      mockPrismaService.instance.findUnique.mockResolvedValue({
        id: 'ins_001',
        tenantId: 'ten_001',
      });
      mockPrismaService.instance.delete.mockResolvedValue({});

      await service.delete('ins_001', 'ten_001');

      expect(mockPrismaService.instance.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ins_001' } }),
      );
      expect(mockRedisService.publish).toHaveBeenCalledWith(
        'instance:disconnect',
        'ins_001',
      );
    });

    it('should throw when instance not found', async () => {
      mockPrismaService.instance.findUnique.mockResolvedValue(null);

      await expect(service.delete('ins_999', 'ten_001')).rejects.toThrow(
        InstanceNotFoundException,
      );
    });
  });
});

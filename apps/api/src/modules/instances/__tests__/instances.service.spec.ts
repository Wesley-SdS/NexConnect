import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InstancesService } from '../instances.service';
import { InstanceNotFoundException } from '@nexconnect/shared';

const mockPrisma = {
  instance: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
};

const mockQrCodeService = {
  generate: vi.fn(),
};

const mockLifecycleQueue = {
  add: vi.fn(),
};

describe('InstancesService', () => {
  let service: InstancesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InstancesService(
      mockPrisma as never,
      mockRedis as never,
      mockQrCodeService as never,
      mockLifecycleQueue as never,
    );
  });

  describe('findAll', () => {
    it('returns all instances for a tenant', async () => {
      const rows = [
        { id: 'i1', tenantId: 't1', connectionType: 'QR_CODE', status: 'CONNECTED' },
      ];
      mockPrisma.instance.findMany.mockResolvedValue(rows);

      const result = await service.findAll('t1');

      expect(result).toEqual(rows);
      expect(mockPrisma.instance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 't1' } }),
      );
    });
  });

  describe('findOne', () => {
    it('returns the instance when found', async () => {
      mockPrisma.instance.findFirst.mockResolvedValue({
        id: 'i1',
        tenantId: 't1',
        connectionType: 'QR_CODE',
      });

      const result = await service.findOne('t1', 'i1');

      expect(result.id).toBe('i1');
    });

    it('throws InstanceNotFoundException when missing', async () => {
      mockPrisma.instance.findFirst.mockResolvedValue(null);

      await expect(service.findOne('t1', 'missing')).rejects.toBeInstanceOf(
        InstanceNotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates an instance with the supplied connection type', async () => {
      mockPrisma.instance.create.mockResolvedValue({
        id: 'i1',
        tenantId: 't1',
        name: 'New',
        connectionType: 'QR_CODE',
      });

      const result = await service.create('t1', {
        name: 'New',
        connectionType: 'QR_CODE' as never,
      });

      expect(result.id).toBe('i1');
      expect(mockPrisma.instance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: 't1', name: 'New' }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('enqueues a disconnect lifecycle job and deletes the row', async () => {
      mockPrisma.instance.findFirst.mockResolvedValue({ id: 'i1', tenantId: 't1' });
      mockPrisma.instance.delete.mockResolvedValue({ id: 'i1' });

      await service.remove('t1', 'i1');

      expect(mockLifecycleQueue.add).toHaveBeenCalledWith(
        'disconnect',
        expect.objectContaining({ instanceId: 'i1', tenantId: 't1' }),
      );
      expect(mockPrisma.instance.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'i1' } }),
      );
    });

    it('throws when the instance does not belong to the tenant', async () => {
      mockPrisma.instance.findFirst.mockResolvedValue(null);

      await expect(service.remove('t1', 'missing')).rejects.toBeInstanceOf(
        InstanceNotFoundException,
      );
    });
  });

  describe('getQrCode', () => {
    it('rejects non-Baileys instances with a clear error', async () => {
      mockPrisma.instance.findFirst.mockResolvedValue({
        id: 'i1',
        tenantId: 't1',
        connectionType: 'WABA',
      });

      await expect(service.getQrCode('t1', 'i1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns the QR code for Baileys instances when redis has data', async () => {
      mockPrisma.instance.findFirst.mockResolvedValue({
        id: 'i1',
        tenantId: 't1',
        connectionType: 'QR_CODE',
      });
      mockRedis.get.mockResolvedValue('qr-data');
      mockQrCodeService.generate.mockResolvedValue({ qrcode: 'data:image/png;base64,...' });

      const result = await service.getQrCode('t1', 'i1');

      expect(result).toEqual({ qrcode: 'data:image/png;base64,...' });
      expect(mockQrCodeService.generate).toHaveBeenCalled();
    });

    it('throws NotFoundException when redis has no QR data yet', async () => {
      mockPrisma.instance.findFirst.mockResolvedValue({
        id: 'i1',
        tenantId: 't1',
        connectionType: 'QR_CODE',
      });
      mockRedis.get.mockResolvedValue(null);

      await expect(service.getQrCode('t1', 'i1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

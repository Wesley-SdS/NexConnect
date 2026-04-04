import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InstanceLifecycleService } from '../instance-lifecycle.service';
import { InstanceNotFoundException } from '@nexconnect/shared';

const mockPrisma = {
  instance: {
    update: vi.fn(),
  },
};

const mockInstancesService = {
  findOne: vi.fn(),
};

const mockLifecycleQueue = {
  add: vi.fn(),
};

describe('InstanceLifecycleService', () => {
  let service: InstanceLifecycleService;

  const tenantId = 'ten-001';
  const instanceId = 'ins-001';
  const instance = { id: instanceId, tenantId, status: 'DISCONNECTED' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInstancesService.findOne.mockResolvedValue(instance);
    mockPrisma.instance.update.mockResolvedValue({ ...instance, status: 'CONNECTING' });
    mockLifecycleQueue.add.mockResolvedValue(undefined);

    service = new InstanceLifecycleService(
      mockPrisma as any,
      mockInstancesService as any,
      mockLifecycleQueue as any,
    );
  });

  describe('powerOn', () => {
    it('should queue connect job and update status to CONNECTING', async () => {
      const result = await service.powerOn(tenantId, instanceId);

      expect(mockInstancesService.findOne).toHaveBeenCalledWith(tenantId, instanceId);
      expect(mockLifecycleQueue.add).toHaveBeenCalledWith('connect', {
        instanceId,
        tenantId,
      });
      expect(mockPrisma.instance.update).toHaveBeenCalledWith({
        where: { id: instanceId },
        data: { status: 'CONNECTING' },
      });
      expect(result).toEqual({
        message: 'Instance is powering on',
        instanceId,
      });
    });

    it('should throw when instance does not exist', async () => {
      mockInstancesService.findOne.mockRejectedValue(
        new InstanceNotFoundException(instanceId),
      );

      await expect(service.powerOn(tenantId, instanceId)).rejects.toThrow(
        InstanceNotFoundException,
      );
      expect(mockLifecycleQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('powerOff', () => {
    it('should queue disconnect job and update status to DISCONNECTED', async () => {
      mockPrisma.instance.update.mockResolvedValue({ ...instance, status: 'DISCONNECTED' });

      const result = await service.powerOff(tenantId, instanceId);

      expect(mockLifecycleQueue.add).toHaveBeenCalledWith('disconnect', {
        instanceId,
        tenantId,
      });
      expect(mockPrisma.instance.update).toHaveBeenCalledWith({
        where: { id: instanceId },
        data: { status: 'DISCONNECTED' },
      });
      expect(result).toEqual({ message: 'Instance is powering off' });
    });

    it('should throw when instance does not exist', async () => {
      mockInstancesService.findOne.mockRejectedValue(
        new InstanceNotFoundException(instanceId),
      );

      await expect(service.powerOff(tenantId, instanceId)).rejects.toThrow(
        InstanceNotFoundException,
      );
    });
  });

  describe('restart', () => {
    it('should queue restart job and update status to CONNECTING', async () => {
      const result = await service.restart(tenantId, instanceId);

      expect(mockLifecycleQueue.add).toHaveBeenCalledWith('restart', {
        instanceId,
        tenantId,
      });
      expect(mockPrisma.instance.update).toHaveBeenCalledWith({
        where: { id: instanceId },
        data: { status: 'CONNECTING' },
      });
      expect(result).toEqual({ message: 'Instance is restarting' });
    });

    it('should throw when instance does not exist', async () => {
      mockInstancesService.findOne.mockRejectedValue(
        new InstanceNotFoundException(instanceId),
      );

      await expect(service.restart(tenantId, instanceId)).rejects.toThrow(
        InstanceNotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('should queue profile update job', async () => {
      const dto = { name: 'New Name', status: 'Available' };
      const result = await service.updateProfile(tenantId, instanceId, dto as any);

      expect(mockLifecycleQueue.add).toHaveBeenCalledWith('update-profile', {
        instanceId,
        tenantId,
        profile: dto,
      });
      expect(result).toEqual({ message: 'Profile update requested' });
    });

    it('should throw when instance does not exist', async () => {
      mockInstancesService.findOne.mockRejectedValue(
        new InstanceNotFoundException(instanceId),
      );

      await expect(
        service.updateProfile(tenantId, instanceId, {} as any),
      ).rejects.toThrow(InstanceNotFoundException);
    });
  });

  describe('getPairingCode', () => {
    it('should queue pairing code request', async () => {
      const phone = '+5511999998888';
      const result = await service.getPairingCode(tenantId, instanceId, phone);

      expect(mockLifecycleQueue.add).toHaveBeenCalledWith('request-pairing-code', {
        instanceId,
        tenantId,
        phoneNumber: phone,
      });
      expect(result).toEqual({
        message: 'Pairing code requested. Check instance status.',
      });
    });

    it('should throw when instance does not exist', async () => {
      mockInstancesService.findOne.mockRejectedValue(
        new InstanceNotFoundException(instanceId),
      );

      await expect(
        service.getPairingCode(tenantId, instanceId, '+5511999998888'),
      ).rejects.toThrow(InstanceNotFoundException);
    });
  });
});

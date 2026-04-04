import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InstanceMetricsService } from '../instance-metrics.service';
import { InstanceNotFoundException } from '@nexconnect/shared';

const mockPrisma = {
  message: {
    groupBy: vi.fn(),
    count: vi.fn(),
  },
  webhookDelivery: {
    aggregate: vi.fn(),
  },
  numberHealth: {
    findUnique: vi.fn(),
  },
  instance: {
    findUnique: vi.fn(),
  },
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
};

const mockInstancesService = {
  findOne: vi.fn(),
};

describe('InstanceMetricsService', () => {
  let service: InstanceMetricsService;

  const tenantId = 'ten-001';
  const instanceId = 'ins-001';
  const instance = { id: instanceId, tenantId, status: 'CONNECTED' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInstancesService.findOne.mockResolvedValue(instance);

    service = new InstanceMetricsService(
      mockPrisma as any,
      mockRedis as any,
      mockInstancesService as any,
    );
  });

  describe('getHealth', () => {
    it('should return cached health data when available', async () => {
      const cachedHealth = {
        instanceId,
        status: 'CONNECTED',
        uptime: 3600,
        numberHealth: { score: 85 },
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedHealth));

      const result = await service.getHealth(tenantId, instanceId);

      expect(mockInstancesService.findOne).toHaveBeenCalledWith(tenantId, instanceId);
      expect(mockRedis.get).toHaveBeenCalledWith(`instance:${instanceId}:health`);
      expect(result).toEqual(cachedHealth);
    });

    it('should return basic status when no cache exists', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getHealth(tenantId, instanceId);

      expect(result).toEqual({
        instanceId,
        status: 'CONNECTED',
        uptime: null,
        numberHealth: null,
      });
    });

    it('should throw when instance does not exist', async () => {
      mockInstancesService.findOne.mockRejectedValue(
        new InstanceNotFoundException(instanceId),
      );

      await expect(service.getHealth(tenantId, instanceId)).rejects.toThrow(
        InstanceNotFoundException,
      );
    });
  });

  describe('getMetrics', () => {
    it('should return cached metrics when available', async () => {
      const cachedMetrics = {
        instanceId,
        period: '24h',
        messagesReceivedTotal: [],
        messagesSentTotal: [],
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedMetrics));

      const result = await service.getMetrics(tenantId, instanceId, '24h');

      expect(mockRedis.get).toHaveBeenCalledWith(`instance:${instanceId}:metrics:24h`);
      expect(result).toEqual(cachedMetrics);
      expect(mockPrisma.message.groupBy).not.toHaveBeenCalled();
    });

    it('should compute fresh metrics from DB when no cache', async () => {
      mockRedis.get.mockResolvedValue(null);

      mockPrisma.message.groupBy
        .mockResolvedValueOnce([{ type: 'text', _count: 10 }])
        .mockResolvedValueOnce([{ type: 'text', status: 'SENT', _count: 8 }]);
      mockPrisma.message.count.mockResolvedValue(2);
      mockPrisma.webhookDelivery.aggregate.mockResolvedValue({
        _avg: { durationMs: 150 },
        _max: { durationMs: 500 },
        _count: 20,
      });
      mockPrisma.numberHealth.findUnique.mockResolvedValue({ score: 90 });
      mockPrisma.instance.findUnique.mockResolvedValue({
        createdAt: new Date(),
        status: 'CONNECTED',
        updatedAt: new Date(Date.now() - 3600_000),
      });

      const result = await service.getMetrics(tenantId, instanceId, '24h');

      expect(result).toHaveProperty('instanceId', instanceId);
      expect(result).toHaveProperty('period', '24h');
      expect(result.messagesReceivedTotal).toHaveLength(1);
      expect(result.messagesSentTotal).toHaveLength(1);
      expect(result.messagesSentFailedTotal).toBe(2);
      expect(result.webhookDeliveryLatencyMs.avg).toBe(150);
      expect(result.numberHealthScore).toBe(90);
      expect(result.connectionUptimeSeconds).toBeGreaterThan(0);
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should use default period 24h when none provided', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ cached: true }));

      await service.getMetrics(tenantId, instanceId);

      expect(mockRedis.get).toHaveBeenCalledWith(`instance:${instanceId}:metrics:24h`);
    });

    it('should throw when instance does not exist', async () => {
      mockInstancesService.findOne.mockRejectedValue(
        new InstanceNotFoundException(instanceId),
      );

      await expect(
        service.getMetrics(tenantId, instanceId, '24h'),
      ).rejects.toThrow(InstanceNotFoundException);
    });
  });

  describe('calculateSinceDate', () => {
    it('should parse hours period', async () => {
      mockRedis.get.mockResolvedValue(null);
      setupDefaultDbMocks();

      await service.getMetrics(tenantId, instanceId, '6h');

      const call = mockPrisma.message.groupBy.mock.calls[0][0];
      const since = call.where.createdAt.gte as Date;
      const expectedMs = 6 * 60 * 60 * 1000;
      const diff = Date.now() - since.getTime();
      expect(diff).toBeGreaterThanOrEqual(expectedMs - 100);
      expect(diff).toBeLessThanOrEqual(expectedMs + 100);
    });

    it('should parse days period', async () => {
      mockRedis.get.mockResolvedValue(null);
      setupDefaultDbMocks();

      await service.getMetrics(tenantId, instanceId, '7d');

      const call = mockPrisma.message.groupBy.mock.calls[0][0];
      const since = call.where.createdAt.gte as Date;
      const expectedMs = 7 * 24 * 60 * 60 * 1000;
      const diff = Date.now() - since.getTime();
      expect(diff).toBeGreaterThanOrEqual(expectedMs - 100);
      expect(diff).toBeLessThanOrEqual(expectedMs + 100);
    });

    it('should parse weeks period', async () => {
      mockRedis.get.mockResolvedValue(null);
      setupDefaultDbMocks();

      await service.getMetrics(tenantId, instanceId, '2w');

      const call = mockPrisma.message.groupBy.mock.calls[0][0];
      const since = call.where.createdAt.gte as Date;
      const expectedMs = 2 * 7 * 24 * 60 * 60 * 1000;
      const diff = Date.now() - since.getTime();
      expect(diff).toBeGreaterThanOrEqual(expectedMs - 100);
      expect(diff).toBeLessThanOrEqual(expectedMs + 100);
    });

    it('should fall back to 24h for invalid period', async () => {
      mockRedis.get.mockResolvedValue(null);
      setupDefaultDbMocks();

      await service.getMetrics(tenantId, instanceId, 'invalid');

      const call = mockPrisma.message.groupBy.mock.calls[0][0];
      const since = call.where.createdAt.gte as Date;
      const expectedMs = 24 * 60 * 60 * 1000;
      const diff = Date.now() - since.getTime();
      expect(diff).toBeGreaterThanOrEqual(expectedMs - 100);
      expect(diff).toBeLessThanOrEqual(expectedMs + 100);
    });
  });

  function setupDefaultDbMocks() {
    mockPrisma.message.groupBy.mockResolvedValue([]);
    mockPrisma.message.count.mockResolvedValue(0);
    mockPrisma.webhookDelivery.aggregate.mockResolvedValue({
      _avg: { durationMs: null },
      _max: { durationMs: null },
      _count: 0,
    });
    mockPrisma.numberHealth.findUnique.mockResolvedValue(null);
    mockPrisma.instance.findUnique.mockResolvedValue({
      createdAt: new Date(),
      status: 'DISCONNECTED',
      updatedAt: new Date(),
    });
    mockRedis.get
      .mockResolvedValueOnce(null) // cache miss
      .mockResolvedValueOnce('0') // reconnection count
      .mockResolvedValueOnce('0'); // buffer flush count
  }
});

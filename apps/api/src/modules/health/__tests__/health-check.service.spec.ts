import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthCheckService } from '../health-check.service';

const mockPrisma = {
  $queryRaw: vi.fn(),
};

const mockRedis = {
  ping: vi.fn(),
};

describe('HealthCheckService', () => {
  let service: HealthCheckService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new HealthCheckService(mockPrisma as any, mockRedis as any);
  });

  describe('checkDatabase', () => {
    it('should return "healthy" when database is reachable', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.checkDatabase();

      expect(result).toBe('healthy');
    });

    it('should return "unhealthy" when database is unreachable', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      const result = await service.checkDatabase();

      expect(result).toBe('unhealthy');
    });
  });

  describe('checkRedis', () => {
    it('should return "healthy" when Redis is reachable', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.checkRedis();

      expect(result).toBe('healthy');
    });

    it('should return "unhealthy" when Redis is unreachable', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection refused'));

      const result = await service.checkRedis();

      expect(result).toBe('unhealthy');
    });
  });

  describe('checkAll', () => {
    it('should return "healthy" status when all checks pass', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.checkAll();

      expect(result).toEqual({
        status: 'healthy',
        checks: {
          database: 'healthy',
          redis: 'healthy',
        },
      });
    });

    it('should return "degraded" status when database is unhealthy', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB down'));
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.checkAll();

      expect(result).toEqual({
        status: 'degraded',
        checks: {
          database: 'unhealthy',
          redis: 'healthy',
        },
      });
    });

    it('should return "degraded" status when Redis is unhealthy', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockRejectedValue(new Error('Redis down'));

      const result = await service.checkAll();

      expect(result).toEqual({
        status: 'degraded',
        checks: {
          database: 'healthy',
          redis: 'unhealthy',
        },
      });
    });

    it('should return "degraded" status when both are unhealthy', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB down'));
      mockRedis.ping.mockRejectedValue(new Error('Redis down'));

      const result = await service.checkAll();

      expect(result.status).toBe('degraded');
      expect(result.checks.database).toBe('unhealthy');
      expect(result.checks.redis).toBe('unhealthy');
    });
  });

  describe('isReady', () => {
    it('should return true when both database and Redis are healthy', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.isReady();

      expect(result).toBe(true);
    });

    it('should return false when database is down', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB down'));
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.isReady();

      expect(result).toBe(false);
    });

    it('should return false when Redis is down', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockRejectedValue(new Error('Redis down'));

      const result = await service.isReady();

      expect(result).toBe(false);
    });

    it('should return false when both are down', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB down'));
      mockRedis.ping.mockRejectedValue(new Error('Redis down'));

      const result = await service.isReady();

      expect(result).toBe(false);
    });
  });
});

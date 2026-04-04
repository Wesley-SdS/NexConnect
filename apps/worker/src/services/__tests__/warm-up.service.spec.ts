import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WarmUpService } from '../warm-up.service';

const mockPrisma = {
  instance: {
    findUnique: vi.fn(),
  },
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
};

describe('WarmUpService', () => {
  let service: WarmUpService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WarmUpService(mockPrisma as any, mockRedis as any);
  });

  function setInstanceAge(days: number) {
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.instance.findUnique.mockResolvedValue({
      createdAt: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    });
  }

  describe('getDailyLimit', () => {
    it('should return 10 for day 1-3', async () => {
      setInstanceAge(2);
      const limit = await service.getDailyLimit('inst-1');
      expect(limit).toBe(10);
    });

    it('should return 50 for day 4-7', async () => {
      setInstanceAge(5);
      const limit = await service.getDailyLimit('inst-1');
      expect(limit).toBe(50);
    });

    it('should return 200 for day 8-14', async () => {
      setInstanceAge(10);
      const limit = await service.getDailyLimit('inst-1');
      expect(limit).toBe(200);
    });

    it('should return 1000 for day 15-30', async () => {
      setInstanceAge(20);
      const limit = await service.getDailyLimit('inst-1');
      expect(limit).toBe(1000);
    });

    it('should return configured limit after day 30', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.instance.findUnique
        .mockResolvedValueOnce({
          createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        })
        .mockResolvedValueOnce({
          settings: { dailyLimit: 8000 },
        });

      const limit = await service.getDailyLimit('inst-1');
      expect(limit).toBe(8000);
    });

    it('should return default 5000 after day 30 without config', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.instance.findUnique
        .mockResolvedValueOnce({
          createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        })
        .mockResolvedValueOnce({ settings: null });

      const limit = await service.getDailyLimit('inst-1');
      expect(limit).toBe(5000);
    });
  });

  describe('getDelay', () => {
    it('should return delay within phase 1 range (15-30s) for day 1-3', async () => {
      setInstanceAge(1);
      const delay = await service.getDelay('inst-1');
      expect(delay).toBeGreaterThanOrEqual(15000);
      expect(delay).toBeLessThan(30000);
    });

    it('should return delay within phase 2 range (5-15s) for day 4-7', async () => {
      setInstanceAge(6);
      const delay = await service.getDelay('inst-1');
      expect(delay).toBeGreaterThanOrEqual(5000);
      expect(delay).toBeLessThan(15000);
    });

    it('should return delay within phase 3 range (2-8s) for day 8-14', async () => {
      setInstanceAge(12);
      const delay = await service.getDelay('inst-1');
      expect(delay).toBeGreaterThanOrEqual(2000);
      expect(delay).toBeLessThan(8000);
    });

    it('should return delay within phase 4 range (1-3s) for day 15-30', async () => {
      setInstanceAge(25);
      const delay = await service.getDelay('inst-1');
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThan(3000);
    });

    it('should return 500ms after day 30', async () => {
      setInstanceAge(45);
      const delay = await service.getDelay('inst-1');
      expect(delay).toBe(500);
    });
  });

  describe('canSend', () => {
    it('should allow sending when under daily limit', async () => {
      setInstanceAge(2);
      mockRedis.get
        .mockResolvedValueOnce(null) // age cache miss
        .mockResolvedValueOnce('5'); // counter = 5, limit = 10

      const can = await service.canSend('inst-1');
      expect(can).toBe(true);
    });

    it('should block sending when at daily limit', async () => {
      setInstanceAge(2);
      mockRedis.get
        .mockResolvedValueOnce(null) // age cache miss
        .mockResolvedValueOnce('10'); // counter = 10, limit = 10

      const can = await service.canSend('inst-1');
      expect(can).toBe(false);
    });

    it('should allow sending when counter does not exist', async () => {
      setInstanceAge(2);
      mockRedis.get
        .mockResolvedValueOnce(null) // age cache miss
        .mockResolvedValueOnce(null); // no counter

      const can = await service.canSend('inst-1');
      expect(can).toBe(true);
    });
  });

  describe('incrementCounter', () => {
    it('should set TTL on first increment', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await service.incrementCounter('inst-1');

      expect(mockRedis.incr).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalledWith(
        expect.stringContaining('warmup:inst-1:'),
        86400,
      );
    });

    it('should not set TTL on subsequent increments', async () => {
      mockRedis.incr.mockResolvedValue(5);

      await service.incrementCounter('inst-1');

      expect(mockRedis.expire).not.toHaveBeenCalled();
    });
  });
});

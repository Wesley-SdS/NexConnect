import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VerificationService } from '../verification.service';

const mockRedisService = {
  get: vi.fn(),
  set: vi.fn(),
};

const mockInstancesService = {
  findOne: vi.fn(),
};

const mockVerificationQueue = {
  add: vi.fn(),
  events: {},
};

describe('VerificationService', () => {
  let service: VerificationService;

  beforeEach(() => {
    vi.clearAllMocks();

    service = new VerificationService(
      mockRedisService as any,
      mockInstancesService as any,
      mockVerificationQueue as any,
    );

    mockInstancesService.findOne.mockResolvedValue({
      id: 'ins-001',
      tenantId: 'ten-001',
      status: 'CONNECTED',
    });
  });

  describe('verifySingle', () => {
    it('should return cached result when available', async () => {
      const cached = {
        phone: '+5511999998888',
        exists: true,
        jid: '5511999998888@s.whatsapp.net',
        pushName: 'John',
      };

      mockRedisService.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.verifySingle(
        'ten-001',
        'ins-001',
        '+5511999998888',
      );

      expect(result).toEqual(cached);
      expect(mockVerificationQueue.add).not.toHaveBeenCalled();
    });

    it('should enqueue verification job on cache miss', async () => {
      mockRedisService.get.mockResolvedValue(null);

      const jobResult = {
        exists: true,
        jid: '5511999998888@s.whatsapp.net',
        profilePicUrl: 'https://example.com/pic.jpg',
        pushName: 'John',
      };

      const mockJob = {
        waitUntilFinished: vi.fn().mockResolvedValue(jobResult),
      };

      mockVerificationQueue.add.mockResolvedValue(mockJob);

      const result = await service.verifySingle(
        'ten-001',
        'ins-001',
        '+5511999998888',
      );

      expect(result.exists).toBe(true);
      expect(result.jid).toBe('5511999998888@s.whatsapp.net');
      expect(result.pushName).toBe('John');
      expect(mockVerificationQueue.add).toHaveBeenCalledWith(
        'verify-number',
        expect.objectContaining({
          instanceId: 'ins-001',
          tenantId: 'ten-001',
        }),
        expect.any(Object),
      );
      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining('verification:'),
        expect.any(String),
        86400,
      );
    });

    it('should return exists false when job returns no result', async () => {
      mockRedisService.get.mockResolvedValue(null);

      const mockJob = {
        waitUntilFinished: vi.fn().mockResolvedValue(null),
      };

      mockVerificationQueue.add.mockResolvedValue(mockJob);

      const result = await service.verifySingle(
        'ten-001',
        'ins-001',
        '+5511999998888',
      );

      expect(result.exists).toBe(false);
      expect(result.jid).toBeNull();
    });
  });

  describe('verifyBatch', () => {
    it('should verify multiple numbers in parallel', async () => {
      const phones = ['+5511999998888', '+5511999997777'];

      const cachedResult = {
        phone: '+5511999998888',
        exists: true,
        jid: '5511999998888@s.whatsapp.net',
      };

      mockRedisService.get
        .mockResolvedValueOnce(JSON.stringify(cachedResult))
        .mockResolvedValueOnce(null);

      const mockJob = {
        waitUntilFinished: vi.fn().mockResolvedValue({
          exists: false,
          jid: null,
        }),
      };

      mockVerificationQueue.add.mockResolvedValue(mockJob);

      const results = await service.verifyBatch('ten-001', 'ins-001', phones);

      expect(results).toHaveLength(2);
      expect(results[0].exists).toBe(true);
      expect(results[1].exists).toBe(false);
    });

    it('should limit batch to 100 numbers', async () => {
      const phones = Array.from({ length: 150 }, (_, i) =>
        `+551199999${String(i).padStart(4, '0')}`,
      );

      mockRedisService.get.mockResolvedValue(
        JSON.stringify({ phone: '', exists: false, jid: null }),
      );

      const results = await service.verifyBatch('ten-001', 'ins-001', phones);

      expect(results).toHaveLength(100);
    });

    it('should handle individual failures gracefully', async () => {
      const phones = ['+5511999998888', '+5511999997777'];

      mockRedisService.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const mockJobSuccess = {
        waitUntilFinished: vi.fn().mockResolvedValue({
          exists: true,
          jid: '5511999998888@s.whatsapp.net',
        }),
      };

      const mockJobFail = {
        waitUntilFinished: vi.fn().mockRejectedValue(new Error('Timeout')),
      };

      mockVerificationQueue.add
        .mockResolvedValueOnce(mockJobSuccess)
        .mockResolvedValueOnce(mockJobFail);

      const results = await service.verifyBatch('ten-001', 'ins-001', phones);

      expect(results).toHaveLength(2);
      expect(results[0].exists).toBe(true);
      expect(results[1].exists).toBe(false);
    });
  });
});

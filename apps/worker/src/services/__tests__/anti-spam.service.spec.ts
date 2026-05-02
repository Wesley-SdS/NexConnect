import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AntiSpamService } from '../anti-spam.service';

const mockPrisma = {
  blacklist: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
  message: {
    count: vi.fn(),
  },
  $queryRaw: vi.fn(),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  exists: vi.fn(),
};

describe('AntiSpamService', () => {
  let service: AntiSpamService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AntiSpamService(mockPrisma as any, mockRedis as any);
  });

  describe('checkBlacklist', () => {
    it('should return true for cached blacklisted phone', async () => {
      mockRedis.get.mockResolvedValue('1');

      const result = await service.checkBlacklist('inst-1', '5511999990000');
      expect(result).toBe(true);
    });

    it('should return false for cached non-blacklisted phone', async () => {
      mockRedis.get.mockResolvedValue('0');

      const result = await service.checkBlacklist('inst-1', '5511999990000');
      expect(result).toBe(false);
    });

    it('should query database on cache miss and cache result', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.blacklist.findFirst.mockResolvedValue({
        instanceId: 'inst-1',
        phone: '5511999990000',
      });

      const result = await service.checkBlacklist('inst-1', '5511999990000');

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'blacklist:inst-1:5511999990000',
        '1',
        3600,
      );
    });

    it('should return false and cache when phone not in database', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.blacklist.findFirst.mockResolvedValue(null);

      const result = await service.checkBlacklist('inst-1', '5511999990000');

      expect(result).toBe(false);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'blacklist:inst-1:5511999990000',
        '0',
        3600,
      );
    });
  });

  describe('checkCooldown', () => {
    it('should return true when cooldown key exists', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await service.checkCooldown('inst-1', '5511999990000');
      expect(result).toBe(true);
    });

    it('should return false when no cooldown key', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await service.checkCooldown('inst-1', '5511999990000');
      expect(result).toBe(false);
    });
  });

  describe('setCooldown', () => {
    it('should set cooldown key with 60s TTL', async () => {
      await service.setCooldown('inst-1', '5511999990000');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'cooldown:inst-1:5511999990000',
        '1',
        60,
      );
    });
  });

  describe('detectSpamPattern', () => {
    it('returns false when no outbound messages exist in the window', async () => {
      mockPrisma.message.count.mockResolvedValue(0);
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await service.detectSpamPattern('inst-1');
      expect(result).toBe(false);
    });

    it('flags spam when fewer than 30% of unique recipients replied', async () => {
      mockPrisma.message.count.mockResolvedValue(100);
      // First $queryRaw call: distinct INBOUND wa_message_ids (replied)
      // Second $queryRaw call: distinct OUTBOUND wa_message_ids (recipients)
      mockPrisma.$queryRaw
        .mockResolvedValueOnce(
          Array.from({ length: 2 }, (_, i) => ({ wa_message_id: `r${i}` })),
        )
        .mockResolvedValueOnce(
          Array.from({ length: 50 }, (_, i) => ({ wa_message_id: `o${i}` })),
        );

      const result = await service.detectSpamPattern('inst-1');
      expect(result).toBe(true);
    });

    it('returns false when reply rate is healthy', async () => {
      mockPrisma.message.count.mockResolvedValue(100);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce(
          Array.from({ length: 8 }, (_, i) => ({ wa_message_id: `r${i}` })),
        )
        .mockResolvedValueOnce(
          Array.from({ length: 10 }, (_, i) => ({ wa_message_id: `o${i}` })),
        );

      const result = await service.detectSpamPattern('inst-1');
      expect(result).toBe(false);
    });
  });

  describe('autoBlacklist', () => {
    it('should not blacklist when fail count is below threshold', async () => {
      const result = await service.autoBlacklist('inst-1', '5511999990000', 3);

      expect(result).toBe(false);
      expect(mockPrisma.blacklist.upsert).not.toHaveBeenCalled();
    });

    it('should blacklist when fail count reaches threshold', async () => {
      mockPrisma.blacklist.upsert.mockResolvedValue({});

      const result = await service.autoBlacklist('inst-1', '5511999990000', 5);

      expect(result).toBe(true);
      expect(mockPrisma.blacklist.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { instanceId_phone: { instanceId: 'inst-1', phone: '5511999990000' } },
          create: expect.objectContaining({ instanceId: 'inst-1', phone: '5511999990000' }),
        }),
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        'blacklist:inst-1:5511999990000',
        '1',
        3600,
      );
    });
  });

  describe('checkSendWindow', () => {
    it('should return true when send window is disabled', () => {
      const result = service.checkSendWindow({
        sendWindow: { enabled: false, startHour: 9, endHour: 18, timezone: 'America/Sao_Paulo' },
      });
      expect(result).toBe(true);
    });

    it('should return true when no send window config', () => {
      const result = service.checkSendWindow({});
      expect(result).toBe(true);
    });

    it('should return true when within send window', () => {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        hour: 'numeric',
        hour12: false,
      });
      const currentHour = parseInt(formatter.format(now), 10);

      const result = service.checkSendWindow({
        sendWindow: {
          enabled: true,
          startHour: currentHour,
          endHour: currentHour + 2,
          timezone: 'UTC',
        },
      });
      expect(result).toBe(true);
    });

    it('should return false when outside send window', () => {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        hour: 'numeric',
        hour12: false,
      });
      const currentHour = parseInt(formatter.format(now), 10);

      const outsideStart = (currentHour + 3) % 24;
      const outsideEnd = (currentHour + 5) % 24;

      const result = service.checkSendWindow({
        sendWindow: {
          enabled: true,
          startHour: outsideStart,
          endHour: outsideEnd > outsideStart ? outsideEnd : 24,
          timezone: 'UTC',
        },
      });
      expect(result).toBe(false);
    });
  });
});

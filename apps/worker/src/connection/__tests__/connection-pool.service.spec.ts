import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionPoolService } from '../connection-pool.service';

const mockBaileysConnectionService = {
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const mockSessionPersistenceService = {
  loadAuthState: vi.fn(),
  saveAuthState: vi.fn(),
};

const mockReconnectionService = {
  scheduleReconnection: vi.fn(),
  cancelReconnection: vi.fn(),
  resetAttempts: vi.fn(),
};

describe('ConnectionPoolService', () => {
  let pool: ConnectionPoolService;

  beforeEach(() => {
    vi.clearAllMocks();
    pool = new ConnectionPoolService(
      mockBaileysConnectionService as any,
      mockSessionPersistenceService as any,
      mockReconnectionService as any,
    );
  });

  describe('addInstance', () => {
    it('should add instance to pool', async () => {
      mockSessionPersistenceService.loadAuthState.mockResolvedValue(null);

      await pool.addInstance('ins_001', { bufferEnabled: true });

      expect(pool.getActiveCount()).toBe(1);
    });

    it('should reject when pool is full', async () => {
      // Fill pool to max (30)
      for (let i = 0; i < 30; i++) {
        mockSessionPersistenceService.loadAuthState.mockResolvedValue(null);
        await pool.addInstance(`ins_${i}`, {});
      }

      await expect(pool.addInstance('ins_overflow', {})).rejects.toThrow(
        /maximum instances/i,
      );
    });
  });

  describe('removeInstance', () => {
    it('should remove instance from pool', async () => {
      mockSessionPersistenceService.loadAuthState.mockResolvedValue(null);
      await pool.addInstance('ins_001', {});

      await pool.removeInstance('ins_001');

      expect(pool.getActiveCount()).toBe(0);
    });

    it('should call disconnect on removal', async () => {
      mockSessionPersistenceService.loadAuthState.mockResolvedValue(null);
      await pool.addInstance('ins_001', {});

      await pool.removeInstance('ins_001');

      expect(mockBaileysConnectionService.disconnect).toHaveBeenCalledWith('ins_001');
    });
  });

  describe('getInstance', () => {
    it('should return instance by id', async () => {
      mockSessionPersistenceService.loadAuthState.mockResolvedValue(null);
      await pool.addInstance('ins_001', { bufferEnabled: true });

      const instance = pool.getInstance('ins_001');

      expect(instance).toBeDefined();
      expect(instance?.id).toBe('ins_001');
    });

    it('should return undefined for non-existent instance', () => {
      const instance = pool.getInstance('ins_nonexistent');

      expect(instance).toBeUndefined();
    });
  });

  describe('getActiveCount', () => {
    it('should return correct count', async () => {
      mockSessionPersistenceService.loadAuthState.mockResolvedValue(null);

      await pool.addInstance('ins_001', {});
      await pool.addInstance('ins_002', {});

      expect(pool.getActiveCount()).toBe(2);

      await pool.removeInstance('ins_001');

      expect(pool.getActiveCount()).toBe(1);
    });
  });
});

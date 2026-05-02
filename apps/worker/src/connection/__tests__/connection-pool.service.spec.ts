import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InstanceStatus } from '@nexconnect/core';
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
    mockSessionPersistenceService.loadAuthState.mockResolvedValue(null);
    pool = new ConnectionPoolService(
      mockBaileysConnectionService as never,
      mockSessionPersistenceService as never,
      mockReconnectionService as never,
    );
  });

  describe('addInstance', () => {
    it('registers an instance in the pool with CONNECTING status', async () => {
      await pool.addInstance('ins_001', { bufferEnabled: true } as never);

      const instance = pool.getInstance('ins_001');
      expect(instance).toBeDefined();
      expect(instance?.status).toBe(InstanceStatus.CONNECTING);
      // No CONNECTED status yet — getActiveCount counts only CONNECTED.
      expect(pool.getActiveCount()).toBe(0);
    });

    it('connects when an existing auth state is found', async () => {
      const fakeAuth = { creds: 'state' };
      mockSessionPersistenceService.loadAuthState.mockResolvedValue(fakeAuth);

      await pool.addInstance('ins_001', {} as never);

      expect(mockBaileysConnectionService.connect).toHaveBeenCalledWith('ins_001', fakeAuth);
    });

    it('rejects with POD_CAPACITY_EXCEEDED when the pool is at MAX_INSTANCES_PER_POD', async () => {
      for (let i = 0; i < 30; i++) {
        await pool.addInstance(`ins_${i}`, {} as never);
      }

      await expect(pool.addInstance('ins_overflow', {} as never)).rejects.toThrow(
        /pod capacity reached/i,
      );
    });

    it('replaces an existing instance when adding the same id twice', async () => {
      await pool.addInstance('ins_001', {} as never);
      await pool.addInstance('ins_001', {} as never);

      expect(mockBaileysConnectionService.disconnect).toHaveBeenCalledWith('ins_001');
    });
  });

  describe('removeInstance', () => {
    it('disconnects baileys and drops the instance', async () => {
      await pool.addInstance('ins_001', {} as never);

      await pool.removeInstance('ins_001');

      expect(mockBaileysConnectionService.disconnect).toHaveBeenCalledWith('ins_001');
      expect(pool.getInstance('ins_001')).toBeUndefined();
    });

    it('cancels any pending reconnection schedule', async () => {
      await pool.addInstance('ins_001', {} as never);

      await pool.removeInstance('ins_001');

      expect(mockReconnectionService.cancelReconnection).toHaveBeenCalledWith('ins_001');
    });

    it('is a noop when the instance is unknown', async () => {
      await pool.removeInstance('missing');

      expect(mockBaileysConnectionService.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('getActiveCount', () => {
    it('counts only instances that have transitioned to CONNECTED', async () => {
      await pool.addInstance('ins_001', {} as never);
      await pool.addInstance('ins_002', {} as never);

      expect(pool.getActiveCount()).toBe(0);

      pool.handleConnectionOpen({
        instanceId: 'ins_001',
        status: InstanceStatus.CONNECTED,
      });
      pool.handleConnectionOpen({
        instanceId: 'ins_002',
        status: InstanceStatus.CONNECTED,
      });

      expect(pool.getActiveCount()).toBe(2);
    });
  });

  describe('handleConnectionOpen', () => {
    it('marks the instance CONNECTED and resets reconnection attempts', async () => {
      await pool.addInstance('ins_001', {} as never);

      pool.handleConnectionOpen({
        instanceId: 'ins_001',
        status: InstanceStatus.CONNECTED,
      });

      expect(pool.getInstance('ins_001')?.status).toBe(InstanceStatus.CONNECTED);
      expect(mockReconnectionService.resetAttempts).toHaveBeenCalledWith('ins_001');
    });
  });
});

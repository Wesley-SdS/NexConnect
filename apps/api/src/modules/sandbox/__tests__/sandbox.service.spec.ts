import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SandboxService } from '../sandbox.service';

const mockPrismaService = {
  sandboxSession: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
};

const mockRedisService = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  incr: vi.fn(),
};

const mockWebhookDispatch = {
  dispatchToInstance: vi.fn(),
};

describe('SandboxService', () => {
  let service: SandboxService;

  beforeEach(() => {
    vi.clearAllMocks();

    service = new SandboxService(
      mockPrismaService as any,
      mockRedisService as any,
      mockWebhookDispatch as any,
    );
  });

  describe('createInstance', () => {
    it('should create a sandbox session with 24h TTL', async () => {
      const created = {
        id: 'session-001',
        tenantId: 'ten-001',
        name: 'Test Sandbox',
        status: 'active',
        settings: {},
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      mockPrismaService.sandboxSession.create.mockResolvedValue(created);

      const result = await service.createInstance('ten-001', {
        name: 'Test Sandbox',
      });

      expect(result.sessionId).toBe('session-001');
      expect(result.status).toBe('active');
      expect(result.quotaRemaining).toBe(100);
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'sandbox:session-001:msgs',
        '0',
        86400,
      );
    });
  });

  describe('simulateInbound', () => {
    it('should simulate an inbound message', async () => {
      const session = {
        id: 'session-001',
        tenantId: 'ten-001',
        status: 'active',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };

      mockPrismaService.sandboxSession.findFirst.mockResolvedValue(session);
      mockRedisService.get.mockResolvedValue('5');

      const result = await service.simulateInbound('ten-001', {
        sessionId: 'session-001',
        from: '+5511999998888',
        type: 'text',
        content: { text: 'Hello from sandbox' },
      });

      expect(result.messageId).toBeDefined();
      expect(result.payload.sandbox).toBe(true);
      expect(result.payload.from).toBe('+5511999998888');
      expect(result.payload.direction).toBe('inbound');
      expect(mockRedisService.incr).toHaveBeenCalledWith(
        'sandbox:session-001:msgs',
      );
    });

    it('should reject when session not found', async () => {
      mockPrismaService.sandboxSession.findFirst.mockResolvedValue(null);

      await expect(
        service.simulateInbound('ten-001', {
          sessionId: 'nonexistent',
          from: '+5511999998888',
          type: 'text',
          content: { text: 'Hello' },
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject when session is expired', async () => {
      const session = {
        id: 'session-001',
        tenantId: 'ten-001',
        status: 'active',
        expiresAt: new Date(Date.now() - 1000),
      };

      mockPrismaService.sandboxSession.findFirst.mockResolvedValue(session);

      await expect(
        service.simulateInbound('ten-001', {
          sessionId: 'session-001',
          from: '+5511999998888',
          type: 'text',
          content: { text: 'Hello' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when quota exceeded', async () => {
      const session = {
        id: 'session-001',
        tenantId: 'ten-001',
        status: 'active',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };

      mockPrismaService.sandboxSession.findFirst.mockResolvedValue(session);
      mockRedisService.get.mockResolvedValue('100');

      await expect(
        service.simulateInbound('ten-001', {
          sessionId: 'session-001',
          from: '+5511999998888',
          type: 'text',
          content: { text: 'Hello' },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('simulateWebhook', () => {
    it('should simulate a webhook event', async () => {
      const session = {
        id: 'session-001',
        tenantId: 'ten-001',
        status: 'active',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };

      mockPrismaService.sandboxSession.findFirst.mockResolvedValue(session);

      const result = await service.simulateWebhook('ten-001', {
        sessionId: 'session-001',
        event: 'message.received',
        data: { text: 'Test message' },
      });

      expect(result.event).toBe('message.received');
      expect(result.delivered).toBe(true);
      expect(result.payload.data.sandbox).toBe(true);
      expect(result.payload.data.sessionId).toBe('session-001');
    });
  });

  describe('listSessions', () => {
    it('should list active sessions with quota info', async () => {
      const sessions = [
        {
          id: 'session-001',
          name: 'Test 1',
          status: 'active',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      ];

      mockPrismaService.sandboxSession.findMany.mockResolvedValue(sessions);
      mockRedisService.get.mockResolvedValue('25');

      const result = await service.listSessions('ten-001');

      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].quotaUsed).toBe(25);
      expect(result.sessions[0].quotaRemaining).toBe(75);
    });
  });

  describe('deleteSession', () => {
    it('should close an active session', async () => {
      const session = {
        id: 'session-001',
        tenantId: 'ten-001',
        status: 'active',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };

      mockPrismaService.sandboxSession.findFirst.mockResolvedValue(session);
      mockPrismaService.sandboxSession.update.mockResolvedValue({
        ...session,
        status: 'closed',
      });

      const result = await service.deleteSession('ten-001', 'session-001');

      expect(result.message).toBe('Sandbox session closed');
      expect(mockRedisService.del).toHaveBeenCalledWith(
        'sandbox:session-001:msgs',
      );
    });
  });
});

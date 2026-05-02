import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnprocessableEntityException, BadRequestException } from '@nestjs/common';
import { MessageType, ProviderType } from '@nexconnect/core';
import { MessagesService } from '../messages.service';

describe('MessagesService', () => {
  const tenantId = 'tenant-1';
  const instanceId = 'instance-1';

  let prisma: {
    message: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
  };
  let instancesService: { findOne: ReturnType<typeof vi.fn> };
  let credentials: {
    findById: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  let dispatcher: { dispatch: ReturnType<typeof vi.fn> };
  let queue: { add: ReturnType<typeof vi.fn> };
  let service: MessagesService;

  beforeEach(() => {
    prisma = {
      message: {
        create: vi.fn(async ({ data }: { data: { id: string } }) => ({
          id: data.id,
          status: 'PENDING',
        })),
        findMany: vi.fn(async () => []),
        findFirst: vi.fn(async () => null),
        count: vi.fn(async () => 0),
      },
    };
    instancesService = {
      findOne: vi.fn(async () => ({
        id: instanceId,
        tenantId,
        connectionType: 'QR_CODE',
        status: 'CONNECTED',
      })),
    };
    credentials = {
      findById: vi.fn(),
      list: vi.fn(async () => []),
    };
    dispatcher = { dispatch: vi.fn() };
    queue = { add: vi.fn() };

    service = new MessagesService(
      prisma as never,
      instancesService as never,
      credentials as never,
      dispatcher as never,
      queue as never,
    );
  });

  describe('send - Baileys instance', () => {
    it('enqueues to the outbound queue', async () => {
      const result = await service.send(tenantId, instanceId, {
        to: '+5511999998888',
        type: MessageType.TEXT,
        content: { text: 'Hello!' },
      });

      expect(result.status).toBe('queued');
      expect(queue.add).toHaveBeenCalledWith(
        'send',
        expect.objectContaining({ to: '+5511999998888', type: MessageType.TEXT }),
        expect.objectContaining({ jobId: expect.any(String) }),
      );
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('send - external provider (Meta/Twilio)', () => {
    beforeEach(() => {
      instancesService.findOne.mockResolvedValue({
        id: instanceId,
        tenantId,
        connectionType: 'WABA',
        status: 'CONNECTED',
      });
    });

    it('dispatches synchronously when the instance has an active credential', async () => {
      credentials.list.mockResolvedValue([
        { id: 'cred-1', provider: ProviderType.META_WHATSAPP_CLOUD, status: 'ACTIVE' },
      ]);
      dispatcher.dispatch.mockResolvedValue({
        ok: true,
        provider: ProviderType.META_WHATSAPP_CLOUD,
        externalMessageId: 'wamid.abc',
        acceptedAt: new Date(),
      });

      const result = await service.send(tenantId, instanceId, {
        to: '+5511999998888',
        type: MessageType.TEXT,
        content: { text: 'Hi' },
      });

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          instanceId,
          credentialId: 'cred-1',
          provider: ProviderType.META_WHATSAPP_CLOUD,
        }),
      );
      expect(result).toMatchObject({
        status: 'sent',
        externalId: 'wamid.abc',
        provider: ProviderType.META_WHATSAPP_CLOUD,
      });
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('throws UnprocessableEntity when no active credential exists', async () => {
      credentials.list.mockResolvedValue([]);

      await expect(
        service.send(tenantId, instanceId, {
          to: '+5511999998888',
          type: MessageType.TEXT,
          content: { text: 'Hi' },
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('propagates validation failures from the provider as BadRequest', async () => {
      credentials.list.mockResolvedValue([
        { id: 'cred-1', provider: ProviderType.META_WHATSAPP_CLOUD, status: 'ACTIVE' },
      ]);
      dispatcher.dispatch.mockResolvedValue({
        ok: false,
        provider: ProviderType.META_WHATSAPP_CLOUD,
        code: 'VALIDATION_FAILED',
        message: 'Invalid recipient',
        retryable: false,
      });

      await expect(
        service.send(tenantId, instanceId, {
          to: '+5511999998888',
          type: MessageType.TEXT,
          content: { text: 'Hi' },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('honors explicit credentialId hint', async () => {
      credentials.findById.mockResolvedValue({
        id: 'cred-custom',
        provider: ProviderType.TWILIO_SMS,
        status: 'ACTIVE',
      });
      dispatcher.dispatch.mockResolvedValue({
        ok: true,
        provider: ProviderType.TWILIO_SMS,
        externalMessageId: 'SMxxx',
        acceptedAt: new Date(),
      });

      await service.send(tenantId, instanceId, {
        to: '+5511999998888',
        type: MessageType.TEXT,
        content: { text: 'Hi' },
        credentialId: 'cred-custom',
      });

      expect(credentials.findById).toHaveBeenCalledWith(tenantId, 'cred-custom');
      expect(credentials.list).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns paginated messages', async () => {
      prisma.message.findMany.mockResolvedValue([{ id: 'msg-1', type: 'TEXT' }]);
      prisma.message.count.mockResolvedValue(1);

      const result = await service.findAll(tenantId, instanceId, { page: 1, limit: 20 });

      expect(result.messages).toHaveLength(1);
      expect(result.pagination).toMatchObject({ page: 1, limit: 20, total: 1 });
    });
  });
});

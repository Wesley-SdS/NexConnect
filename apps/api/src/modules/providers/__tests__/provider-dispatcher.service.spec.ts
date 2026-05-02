import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IMessagingProvider,
  MessageType,
  OutboundMessage,
  ProviderCapability,
  ProviderChannel,
  ProviderType,
} from '@nexconnect/core';
import { ProviderDispatcherService } from '../provider-dispatcher.service';
import { ProviderRegistry } from '../provider-registry.service';

function makePrismaStub() {
  const messages = new Map<string, Record<string, unknown>>();
  const credentials = new Map<string, { provider: ProviderType; status: string }>();
  return {
    messages,
    credentials,
    providerCredential: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const c = credentials.get(where.id);
        return c ? { id: where.id, provider: c.provider, status: c.status } : null;
      }),
      findFirst: vi.fn(async () => null),
    },
    message: {
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = messages.get(where.id) ?? { id: where.id };
        Object.assign(existing, data);
        messages.set(where.id, existing);
        return existing;
      }),
    },
    externalMessageMapping: {
      upsert: vi.fn(async () => ({ id: 'map_1' })),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

function makeFakeProvider(responses: {
  ok?: {
    externalMessageId: string;
    recipientId?: string;
  };
  fail?: { code: string; message: string; retryable: boolean };
}): IMessagingProvider {
  return {
    type: ProviderType.META_WHATSAPP_CLOUD,
    channel: ProviderChannel.WHATSAPP,
    capabilities: new Set([ProviderCapability.SEND_TEXT]),
    supports: () => true,
    send: vi.fn(async () => {
      if (responses.ok) {
        return {
          ok: true,
          provider: ProviderType.META_WHATSAPP_CLOUD,
          externalMessageId: responses.ok.externalMessageId,
          recipientId: responses.ok.recipientId,
          acceptedAt: new Date(),
        };
      }
      return {
        ok: false,
        provider: ProviderType.META_WHATSAPP_CLOUD,
        code: responses.fail!.code,
        message: responses.fail!.message,
        retryable: responses.fail!.retryable,
      };
    }),
  };
}

const textMessage: OutboundMessage = {
  type: MessageType.TEXT,
  to: '+5511999998888',
  text: 'Hello',
};

describe('ProviderDispatcherService', () => {
  let registry: ProviderRegistry;
  let prisma: ReturnType<typeof makePrismaStub>;
  let credentials: {
    findById: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    registry = new ProviderRegistry();
    prisma = makePrismaStub();
    credentials = {
      findById: vi.fn(async (_tenantId: string, id: string) => ({
        id,
        provider: ProviderType.META_WHATSAPP_CLOUD,
        status: 'ACTIVE',
      })),
    };
  });

  it('dispatches to the registered provider and persists success', async () => {
    const provider = makeFakeProvider({ ok: { externalMessageId: 'wamid.ABC', recipientId: '5511' } });
    registry.register(provider);
    prisma.credentials.set('cred-1', { provider: ProviderType.META_WHATSAPP_CLOUD, status: 'ACTIVE' });

    const dispatcher = new ProviderDispatcherService(
      prisma as never,
      registry,
      credentials as never,
    );

    const result = await dispatcher.dispatch({
      tenantId: 't',
      instanceId: 'i',
      credentialId: 'cred-1',
      message: textMessage,
      messageId: 'msg-1',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.externalMessageId).toBe('wamid.ABC');
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('marks message as FAILED on provider failure', async () => {
    const provider = makeFakeProvider({
      fail: { code: 'VALIDATION_FAILED', message: 'Invalid template', retryable: false },
    });
    registry.register(provider);
    prisma.credentials.set('cred-1', { provider: ProviderType.META_WHATSAPP_CLOUD, status: 'ACTIVE' });

    const dispatcher = new ProviderDispatcherService(
      prisma as never,
      registry,
      credentials as never,
    );

    const result = await dispatcher.dispatch({
      tenantId: 't',
      instanceId: 'i',
      credentialId: 'cred-1',
      message: textMessage,
      messageId: 'msg-2',
    });

    expect(result.ok).toBe(false);
    expect(prisma.message.update).toHaveBeenCalled();
    const lastCall = prisma.message.update.mock.calls.at(-1)![0] as { data: { status: string } };
    expect(lastCall.data.status).toBe('FAILED');
  });

  it('throws when provider is not registered', async () => {
    prisma.credentials.set('cred-1', { provider: ProviderType.META_WHATSAPP_CLOUD, status: 'ACTIVE' });
    const dispatcher = new ProviderDispatcherService(
      prisma as never,
      registry,
      credentials as never,
    );

    await expect(
      dispatcher.dispatch({
        tenantId: 't',
        instanceId: 'i',
        credentialId: 'cred-1',
        message: textMessage,
        messageId: 'msg-3',
      }),
    ).rejects.toThrow(/No messaging provider registered/);
  });

  it('refuses inactive credentials', async () => {
    prisma.credentials.set('cred-1', { provider: ProviderType.META_WHATSAPP_CLOUD, status: 'REVOKED' });
    const provider = makeFakeProvider({ ok: { externalMessageId: 'x' } });
    registry.register(provider);

    const dispatcher = new ProviderDispatcherService(
      prisma as never,
      registry,
      credentials as never,
    );

    await expect(
      dispatcher.dispatch({
        tenantId: 't',
        instanceId: 'i',
        credentialId: 'cred-1',
        message: textMessage,
        messageId: 'msg-4',
      }),
    ).rejects.toThrow(/not active/);
  });
});

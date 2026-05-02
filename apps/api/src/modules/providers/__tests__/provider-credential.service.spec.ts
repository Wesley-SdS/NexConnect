import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ProviderType } from '@nexconnect/core';
import { CredentialEncryptionService } from '../credential-encryption.service';
import { ProviderCredentialService } from '../provider-credential.service';

type ProviderCredentialRow = {
  id: string;
  tenantId: string;
  instanceId: string | null;
  provider: string;
  displayName: string;
  credentialsEncrypted: Uint8Array;
  externalAccountId: string | null;
  externalPhoneId: string | null;
  phoneNumber: string | null;
  webhookVerifyToken: string | null;
  webhookCallbackUrl: string | null;
  status: string;
  lastUsedAt: Date | null;
  lastRotatedAt: Date | null;
  expiresAt: Date | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function makePrismaStub() {
  const store = new Map<string, ProviderCredentialRow>();
  return {
    providerCredential: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row: ProviderCredentialRow = {
          id: `cred_${store.size + 1}`,
          tenantId: data.tenantId as string,
          instanceId: (data.instanceId as string | undefined) ?? null,
          provider: data.provider as string,
          displayName: data.displayName as string,
          credentialsEncrypted: data.credentialsEncrypted as Uint8Array,
          externalAccountId: (data.externalAccountId as string | undefined) ?? null,
          externalPhoneId: (data.externalPhoneId as string | undefined) ?? null,
          phoneNumber: (data.phoneNumber as string | undefined) ?? null,
          webhookVerifyToken: (data.webhookVerifyToken as string | undefined) ?? null,
          webhookCallbackUrl: (data.webhookCallbackUrl as string | undefined) ?? null,
          status: 'ACTIVE',
          lastUsedAt: null,
          lastRotatedAt: null,
          expiresAt: (data.expiresAt as Date | undefined) ?? null,
          metadata: data.metadata ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.set(row.id, row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return store.get(where.id) ?? null;
      }),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        for (const row of store.values()) {
          if (where.id && row.id !== where.id) continue;
          if (where.tenantId && row.tenantId !== where.tenantId) continue;
          if (where.externalAccountId && row.externalAccountId !== where.externalAccountId) continue;
          if (where.externalPhoneId && row.externalPhoneId !== where.externalPhoneId) continue;
          if (where.status && row.status !== where.status) continue;
          return row;
        }
        return null;
      }),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        return [...store.values()].filter((row) => {
          if (where.tenantId && row.tenantId !== where.tenantId) return false;
          if (where.instanceId && row.instanceId !== where.instanceId) return false;
          return true;
        });
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = store.get(where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        row.updatedAt = new Date();
        store.set(row.id, row);
        return row;
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        store.delete(where.id);
      }),
    },
  };
}

describe('ProviderCredentialService', () => {
  let service: ProviderCredentialService;
  let crypto: CredentialEncryptionService;
  let prisma: ReturnType<typeof makePrismaStub>;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'unit-test-key-32-bytes-exactly-!';
    crypto = new CredentialEncryptionService();
    prisma = makePrismaStub();
    service = new ProviderCredentialService(prisma as never, crypto);
  });

  it('encrypts credentials on create and exposes public identifiers', async () => {
    const tenantId = 'tenant-1';
    const result = await service.create({
      tenantId,
      instanceId: 'instance-1',
      provider: ProviderType.META_WHATSAPP_CLOUD,
      displayName: 'WABA Prod',
      credentials: {
        type: ProviderType.META_WHATSAPP_CLOUD,
        businessAccountId: '1234567890',
        phoneNumberId: '0987654321',
        accessToken: 'EAAx...secret-must-be-encrypted',
        appSecret: 'super-secret',
        webhookVerifyToken: 'vt',
      },
    });

    expect(result).toMatchObject({
      provider: ProviderType.META_WHATSAPP_CLOUD,
      externalAccountId: '1234567890',
      externalPhoneId: '0987654321',
      status: 'ACTIVE',
    });
    const raw = prisma.providerCredential.create.mock.calls[0][0].data.credentialsEncrypted as Uint8Array;
    // Ciphertext MUST NOT contain the plaintext access_token
    const plaintext = Buffer.from(raw).toString('utf8');
    expect(plaintext).not.toContain('EAAx...secret-must-be-encrypted');
  });

  it('roundtrips encryption when resolving a credential', async () => {
    const created = await service.create({
      tenantId: 't',
      provider: ProviderType.TWILIO_SMS,
      displayName: 'Twilio Prod',
      credentials: {
        type: ProviderType.TWILIO_SMS,
        accountSid: 'ACxx',
        authToken: 'hidden-token',
        fromNumber: '+15550001111',
      },
    });

    const resolved = await service.resolveTwilio(created.id);
    expect(resolved).toMatchObject({
      type: ProviderType.TWILIO_SMS,
      accountSid: 'ACxx',
      authToken: 'hidden-token',
      fromNumber: '+15550001111',
    });
  });

  it('rejects mismatched credential shape on create', async () => {
    await expect(
      service.create({
        tenantId: 't',
        provider: ProviderType.META_WHATSAPP_CLOUD,
        displayName: 'wrong',
        credentials: {
          type: ProviderType.TWILIO_SMS,
          accountSid: 'ACxx',
          authToken: 't',
        },
      }),
    ).rejects.toThrow(/does not match META_WHATSAPP_CLOUD/);
  });

  it('rejects resolveMetaWhatsApp with a Twilio credential', async () => {
    const created = await service.create({
      tenantId: 't',
      provider: ProviderType.TWILIO_SMS,
      displayName: 'Twilio',
      credentials: {
        type: ProviderType.TWILIO_SMS,
        accountSid: 'AC',
        authToken: 't',
      },
    });
    await expect(service.resolveMetaWhatsApp(created.id)).rejects.toThrow(
      /not a Meta WhatsApp Cloud credential/,
    );
  });

  it('throws NotFoundException for unknown credential ids', async () => {
    await expect(service.findById('t', 'missing-id')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('finds credential by external phone id (Meta)', async () => {
    const created = await service.create({
      tenantId: 't',
      provider: ProviderType.META_WHATSAPP_CLOUD,
      displayName: 'WABA',
      credentials: {
        type: ProviderType.META_WHATSAPP_CLOUD,
        businessAccountId: 'BA1',
        phoneNumberId: 'PN123',
        accessToken: 'EAAx',
        appSecret: 'secret',
        webhookVerifyToken: 'vt',
      },
    });
    const owner = await service.findByExternalPhoneId('PN123');
    expect(owner).toMatchObject({
      credentialId: created.id,
      provider: ProviderType.META_WHATSAPP_CLOUD,
    });
  });

  it('finds credential by account sid (Twilio)', async () => {
    const created = await service.create({
      tenantId: 't',
      provider: ProviderType.TWILIO_WHATSAPP,
      displayName: 'Twilio WA',
      credentials: {
        type: ProviderType.TWILIO_WHATSAPP,
        accountSid: 'ACabc',
        authToken: 'token',
      },
    });
    const owner = await service.findByAccountSid('ACabc');
    expect(owner).toMatchObject({
      credentialId: created.id,
      provider: ProviderType.TWILIO_WHATSAPP,
    });
  });
});

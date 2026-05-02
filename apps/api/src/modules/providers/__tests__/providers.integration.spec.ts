import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { setupTestContainers, TestContainers, createTestPrismaClient, cleanDatabase } from '@nexconnect/testing';
import { ProviderType } from '@nexconnect/core';
import { CredentialEncryptionService } from '../credential-encryption.service';
import { ProviderCredentialService } from '../provider-credential.service';

describe('Providers integration (Testcontainers)', () => {
  let containers: TestContainers;
  let prisma: PrismaClient;
  let service: ProviderCredentialService;

  beforeAll(async () => {
    containers = await setupTestContainers();
    prisma = await createTestPrismaClient();
    process.env.ENCRYPTION_KEY = 'integration-test-key-32-bytes!!!';
    service = new ProviderCredentialService(prisma as never, new CredentialEncryptionService());
  }, 180_000);

  afterAll(async () => {
    await prisma.$disconnect();
    await containers.cleanup();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  async function createTenant(name = 'Integration Tenant') {
    return prisma.tenant.create({ data: { name, plan: 'PRO' } });
  }

  it('persists encrypted credentials and recovers plaintext on resolve', async () => {
    const tenant = await createTenant();

    const created = await service.create({
      tenantId: tenant.id,
      provider: ProviderType.META_WHATSAPP_CLOUD,
      displayName: 'Production WABA',
      credentials: {
        type: ProviderType.META_WHATSAPP_CLOUD,
        businessAccountId: 'BA-123',
        phoneNumberId: 'PN-456',
        accessToken: 'EAA-secret-token',
        appSecret: 'app-secret-xyz',
        webhookVerifyToken: 'verify-token',
      },
    });

    expect(created.externalAccountId).toBe('BA-123');
    expect(created.externalPhoneId).toBe('PN-456');

    // Stored bytes must NOT contain plaintext.
    const row = await prisma.providerCredential.findUnique({ where: { id: created.id } });
    const stored = Buffer.from(row!.credentialsEncrypted).toString('utf8');
    expect(stored).not.toContain('EAA-secret-token');
    expect(stored).not.toContain('app-secret-xyz');

    const decrypted = await service.resolveMetaWhatsApp(created.id);
    expect(decrypted).toMatchObject({
      businessAccountId: 'BA-123',
      phoneNumberId: 'PN-456',
      accessToken: 'EAA-secret-token',
      appSecret: 'app-secret-xyz',
      webhookVerifyToken: 'verify-token',
    });
  });

  it('rotates secrets and stamps lastRotatedAt', async () => {
    const tenant = await createTenant();
    const created = await service.create({
      tenantId: tenant.id,
      provider: ProviderType.TWILIO_SMS,
      displayName: 'Twilio v1',
      credentials: {
        type: ProviderType.TWILIO_SMS,
        accountSid: 'AC-old',
        authToken: 'token-old',
      },
    });
    expect(created.lastRotatedAt).toBeNull();

    const updated = await service.update(created.id, {
      credentials: {
        type: ProviderType.TWILIO_SMS,
        accountSid: 'AC-new',
        authToken: 'token-new',
      },
    });

    expect(updated.lastRotatedAt).not.toBeNull();
    const resolved = await service.resolveTwilio(created.id);
    expect(resolved.accountSid).toBe('AC-new');
    expect(resolved.authToken).toBe('token-new');
  });

  it('finds owner by external phone id (Meta) for webhook routing', async () => {
    const tenant = await createTenant();
    const instance = await prisma.instance.create({
      data: { tenantId: tenant.id, name: 'WABA', connectionType: 'WABA', status: 'CONNECTED' },
    });
    const credential = await service.create({
      tenantId: tenant.id,
      instanceId: instance.id,
      provider: ProviderType.META_WHATSAPP_CLOUD,
      displayName: 'WABA Prod',
      credentials: {
        type: ProviderType.META_WHATSAPP_CLOUD,
        businessAccountId: 'BA-1',
        phoneNumberId: 'PHONE-LOOKUP',
        accessToken: 't',
        appSecret: 's',
        webhookVerifyToken: 'vt',
      },
    });

    const owner = await service.findByExternalPhoneId('PHONE-LOOKUP');
    expect(owner).toEqual({
      credentialId: credential.id,
      tenantId: tenant.id,
      instanceId: instance.id,
      provider: ProviderType.META_WHATSAPP_CLOUD,
    });
  });

  it('finds owner by Twilio AccountSid for signature validation', async () => {
    const tenant = await createTenant();
    const instance = await prisma.instance.create({
      data: { tenantId: tenant.id, name: 'TW', connectionType: 'WABA', status: 'CONNECTED' },
    });
    const credential = await service.create({
      tenantId: tenant.id,
      instanceId: instance.id,
      provider: ProviderType.TWILIO_WHATSAPP,
      displayName: 'TW Prod',
      credentials: {
        type: ProviderType.TWILIO_WHATSAPP,
        accountSid: 'ACINTEGRATION',
        authToken: 'integration-token',
      },
    });

    const owner = await service.findByAccountSid('ACINTEGRATION');
    expect(owner?.credentialId).toBe(credential.id);
    expect(owner?.provider).toBe(ProviderType.TWILIO_WHATSAPP);
  });

  it('list filters by provider and instanceId', async () => {
    const tenant = await createTenant();
    const instance1 = await prisma.instance.create({
      data: { tenantId: tenant.id, name: 'i1', connectionType: 'WABA', status: 'CONNECTED' },
    });
    const instance2 = await prisma.instance.create({
      data: { tenantId: tenant.id, name: 'i2', connectionType: 'WABA', status: 'CONNECTED' },
    });

    await service.create({
      tenantId: tenant.id,
      instanceId: instance1.id,
      provider: ProviderType.META_WHATSAPP_CLOUD,
      displayName: 'WABA',
      credentials: {
        type: ProviderType.META_WHATSAPP_CLOUD,
        businessAccountId: 'BA',
        phoneNumberId: 'PN',
        accessToken: 't',
        appSecret: 's',
        webhookVerifyToken: 'v',
      },
    });
    await service.create({
      tenantId: tenant.id,
      instanceId: instance2.id,
      provider: ProviderType.TWILIO_SMS,
      displayName: 'TW',
      credentials: { type: ProviderType.TWILIO_SMS, accountSid: 'AC', authToken: 't' },
    });

    const all = await service.list(tenant.id);
    expect(all).toHaveLength(2);

    const byInstance = await service.list(tenant.id, { instanceId: instance1.id });
    expect(byInstance).toHaveLength(1);
    expect(byInstance[0].instanceId).toBe(instance1.id);

    const byProvider = await service.list(tenant.id, { provider: ProviderType.TWILIO_SMS });
    expect(byProvider).toHaveLength(1);
    expect(byProvider[0].provider).toBe(ProviderType.TWILIO_SMS);
  });

  it('cascades credential deletion when tenant is deleted', async () => {
    const tenant = await createTenant();
    const created = await service.create({
      tenantId: tenant.id,
      provider: ProviderType.TWILIO_SMS,
      displayName: 'Cascade test',
      credentials: { type: ProviderType.TWILIO_SMS, accountSid: 'AC', authToken: 't' },
    });

    await prisma.tenant.delete({ where: { id: tenant.id } });

    const remaining = await prisma.providerCredential.findUnique({ where: { id: created.id } });
    expect(remaining).toBeNull();
  });
});

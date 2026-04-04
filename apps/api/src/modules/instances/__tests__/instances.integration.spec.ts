import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestContainers, TestContainers } from '@nexconnect/testing';
import { createTestPrismaClient, cleanDatabase } from '@nexconnect/testing';
import { PrismaClient } from '@prisma/client';

describe('Instances Integration (Testcontainers)', () => {
  let containers: TestContainers;
  let prisma: PrismaClient;

  beforeAll(async () => {
    containers = await setupTestContainers();
    prisma = await createTestPrismaClient();
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
    await containers.cleanup();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it('should create and retrieve an instance', async () => {
    const tenant = await prisma.tenant.create({
      data: { name: 'Test Tenant', plan: 'PRO' },
    });

    const instance = await prisma.instance.create({
      data: {
        tenantId: tenant.id,
        name: 'Test Instance',
        connectionType: 'QR_CODE',
        status: 'CREATED',
      },
    });

    const found = await prisma.instance.findUnique({ where: { id: instance.id } });
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Test Instance');
    expect(found!.tenantId).toBe(tenant.id);
  });

  it('should enforce tenant isolation via application logic', async () => {
    const tenantA = await prisma.tenant.create({ data: { name: 'Tenant A', plan: 'PRO' } });
    const tenantB = await prisma.tenant.create({ data: { name: 'Tenant B', plan: 'PRO' } });

    await prisma.instance.create({
      data: { tenantId: tenantA.id, name: 'A Instance', connectionType: 'QR_CODE', status: 'CREATED' },
    });

    await prisma.instance.create({
      data: { tenantId: tenantB.id, name: 'B Instance', connectionType: 'QR_CODE', status: 'CREATED' },
    });

    const aInstances = await prisma.instance.findMany({ where: { tenantId: tenantA.id } });
    const bInstances = await prisma.instance.findMany({ where: { tenantId: tenantB.id } });

    expect(aInstances).toHaveLength(1);
    expect(bInstances).toHaveLength(1);
    expect(aInstances[0].name).toBe('A Instance');
    expect(bInstances[0].name).toBe('B Instance');
  });

  it('should persist and retrieve encrypted auth state', async () => {
    const tenant = await prisma.tenant.create({ data: { name: 'Test', plan: 'PRO' } });
    const instance = await prisma.instance.create({
      data: { tenantId: tenant.id, name: 'Auth Test', connectionType: 'QR_CODE', status: 'CREATED' },
    });

    const fakeAuthState = Buffer.from('encrypted-auth-state-data');
    await prisma.instance.update({
      where: { id: instance.id },
      data: { authStateEncrypted: fakeAuthState },
    });

    const updated = await prisma.instance.findUnique({ where: { id: instance.id } });
    expect(updated!.authStateEncrypted).not.toBeNull();
    expect(Buffer.from(updated!.authStateEncrypted!).toString()).toBe('encrypted-auth-state-data');
  });

  it('should cascade delete messages when instance is deleted', async () => {
    const tenant = await prisma.tenant.create({ data: { name: 'Test', plan: 'PRO' } });
    const instance = await prisma.instance.create({
      data: { tenantId: tenant.id, name: 'Cascade Test', connectionType: 'QR_CODE', status: 'CREATED' },
    });

    await prisma.message.create({
      data: {
        id: 'msg_test_001',
        instanceId: instance.id,
        tenantId: tenant.id,
        direction: 'INBOUND',
        type: 'TEXT',
        content: { text: 'Hello' },
        status: 'PENDING',
      },
    });

    await prisma.instance.delete({ where: { id: instance.id } });

    const messages = await prisma.message.findMany({ where: { instanceId: instance.id } });
    expect(messages).toHaveLength(0);
  });
});

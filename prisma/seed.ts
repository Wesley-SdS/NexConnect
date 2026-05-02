/**
 * NexConnect demo seed.
 *
 * Creates a deterministic dev tenant with one of each provider
 * connection type so local end-to-end smoke tests have something to
 * point at without manual setup.
 *
 *   pnpm db:seed
 *
 * Idempotent: re-running upserts existing rows.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { createCipheriv, randomBytes } from 'crypto';

const prisma = new PrismaClient();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'dev-encryption-key-32bytes-here!';
const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function encrypt(payload: object): Uint8Array {
  const keyBuffer = Buffer.alloc(32);
  Buffer.from(ENCRYPTION_KEY, 'utf8').copy(keyBuffer, 0, 0, 32);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(AES_ALGORITHM, keyBuffer, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const blob = Buffer.concat([iv, authTag, encrypted]);
  return new Uint8Array(blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength));
}

async function main() {
  console.log('🌱 Seeding NexConnect demo data...');

  const tenant = await prisma.tenant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Demo Tenant',
      plan: 'PRO',
    },
    update: { name: 'Demo Tenant' },
  });
  console.log(`  ✓ tenant ${tenant.id} (${tenant.name})`);

  // ─── Baileys instance (legacy / unofficial) ─────────────
  const baileysInstance = await prisma.instance.upsert({
    where: { id: '00000000-0000-0000-0000-00000000a001' },
    create: {
      id: '00000000-0000-0000-0000-00000000a001',
      tenantId: tenant.id,
      name: 'Demo Baileys',
      connectionType: 'QR_CODE',
      status: 'DISCONNECTED',
    },
    update: { name: 'Demo Baileys' },
  });
  console.log(`  ✓ instance ${baileysInstance.id} (Baileys QR)`);

  // ─── Meta WhatsApp Cloud instance + credential ──────────
  const wabaInstance = await prisma.instance.upsert({
    where: { id: '00000000-0000-0000-0000-00000000a002' },
    create: {
      id: '00000000-0000-0000-0000-00000000a002',
      tenantId: tenant.id,
      name: 'Demo WABA',
      connectionType: 'WABA',
      status: 'CONNECTED',
      phoneNumber: '+15550001111',
    },
    update: { name: 'Demo WABA' },
  });
  console.log(`  ✓ instance ${wabaInstance.id} (Meta WhatsApp Cloud)`);

  const metaCredential = await prisma.providerCredential.upsert({
    where: { id: '00000000-0000-0000-0000-0000000c0001' },
    create: {
      id: '00000000-0000-0000-0000-0000000c0001',
      tenantId: tenant.id,
      instanceId: wabaInstance.id,
      provider: 'META_WHATSAPP_CLOUD',
      displayName: 'Demo WABA — Sandbox',
      credentialsEncrypted: encrypt({
        type: 'META_WHATSAPP_CLOUD',
        businessAccountId: '0000000000000000',
        phoneNumberId: '1111111111111111',
        accessToken: 'EAA-DEV-FAKE-ACCESS-TOKEN',
        appSecret: 'DEV-FAKE-APP-SECRET',
        webhookVerifyToken: 'dev-verify-token',
        graphApiVersion: 'v21.0',
      }),
      externalAccountId: '0000000000000000',
      externalPhoneId: '1111111111111111',
      phoneNumber: '+15550001111',
      webhookVerifyToken: 'dev-verify-token',
      status: 'ACTIVE',
      metadata: { source: 'seed' } as Prisma.InputJsonValue,
    },
    update: { displayName: 'Demo WABA — Sandbox' },
  });
  console.log(`  ✓ credential ${metaCredential.id} (Meta WhatsApp Cloud)`);

  // ─── Twilio SMS + WhatsApp credentials ──────────────────
  const twilioInstance = await prisma.instance.upsert({
    where: { id: '00000000-0000-0000-0000-00000000a003' },
    create: {
      id: '00000000-0000-0000-0000-00000000a003',
      tenantId: tenant.id,
      name: 'Demo Twilio',
      connectionType: 'WABA',
      status: 'CONNECTED',
      phoneNumber: '+15550002222',
    },
    update: { name: 'Demo Twilio' },
  });
  console.log(`  ✓ instance ${twilioInstance.id} (Twilio messaging)`);

  const twilioCredential = await prisma.providerCredential.upsert({
    where: { id: '00000000-0000-0000-0000-0000000c0002' },
    create: {
      id: '00000000-0000-0000-0000-0000000c0002',
      tenantId: tenant.id,
      instanceId: twilioInstance.id,
      provider: 'TWILIO_WHATSAPP',
      displayName: 'Demo Twilio Sandbox',
      credentialsEncrypted: encrypt({
        type: 'TWILIO_WHATSAPP',
        accountSid: 'ACdev0000000000000000000000000000',
        authToken: 'dev-auth-token',
        messagingServiceSid: 'MGdev0000000000000000000000000000',
        fromNumber: '+14155238886',
      }),
      externalAccountId: 'ACdev0000000000000000000000000000',
      phoneNumber: '+14155238886',
      status: 'ACTIVE',
      metadata: { source: 'seed' } as Prisma.InputJsonValue,
    },
    update: { displayName: 'Demo Twilio Sandbox' },
  });
  console.log(`  ✓ credential ${twilioCredential.id} (Twilio WhatsApp)`);

  // ─── Sample message templates (Meta) ────────────────────
  await prisma.messageTemplate.upsert({
    where: {
      credentialId_name_language: {
        credentialId: metaCredential.id,
        name: 'order_confirmation',
        language: 'pt_BR',
      },
    },
    create: {
      tenantId: tenant.id,
      credentialId: metaCredential.id,
      externalTemplateId: 'tpl_order_confirmation_pt',
      name: 'order_confirmation',
      language: 'pt_BR',
      category: 'UTILITY',
      status: 'APPROVED',
      components: [
        {
          type: 'BODY',
          text: 'Olá {{1}}, seu pedido {{2}} foi confirmado!',
        },
      ] as unknown as Prisma.InputJsonValue,
    },
    update: { status: 'APPROVED' },
  });
  console.log('  ✓ template order_confirmation (pt_BR)');

  console.log('✅ Seed complete.');
  console.log('');
  console.log('   Tenant ID:     00000000-0000-0000-0000-000000000001');
  console.log('   Baileys:       00000000-0000-0000-0000-00000000a001');
  console.log('   Meta WABA:     00000000-0000-0000-0000-00000000a002');
  console.log('   Twilio:        00000000-0000-0000-0000-00000000a003');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

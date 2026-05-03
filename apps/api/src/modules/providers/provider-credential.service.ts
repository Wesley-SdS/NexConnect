import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  MetaInstagramCredentials,
  MetaMessengerCredentials,
  MetaWhatsAppCloudCredentials,
  ProviderCredentialData,
  ProviderType,
  TwilioCredentials,
  isMetaCredentials,
  isTwilioCredentials,
} from '@nexconnect/core';
import { PrismaService } from '@nexconnect/database';
import { $Enums, Prisma } from '@prisma/client';
import { CredentialResolver } from './credential.resolver';
import { CredentialEncryptionService } from './credential-encryption.service';

export interface CreateCredentialInput {
  tenantId: string;
  instanceId?: string;
  provider: ProviderType;
  displayName: string;
  credentials: ProviderCredentialData;
  webhookCallbackUrl?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface UpdateCredentialInput {
  displayName?: string;
  credentials?: ProviderCredentialData;
  webhookCallbackUrl?: string;
  status?: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'ERROR';
  metadata?: Record<string, unknown>;
  expiresAt?: Date | null;
}

// Forward type to avoid circular import on the orchestrator. The
// concrete value is supplied by ProvidersModule via the
// ProviderLifecycleOrchestrator provider.
type LifecycleOrchestrator = {
  fireCreated(provider: ProviderType, ctx: { tenantId: string; instanceId: string; credentialId: string }): Promise<void>;
  fireRotated(provider: ProviderType, ctx: { tenantId: string; instanceId: string; credentialId: string }): Promise<void>;
  fireRevoked(provider: ProviderType, ctx: { tenantId: string; instanceId: string; credentialId: string }): Promise<void>;
};

@Injectable()
export class ProviderCredentialService implements CredentialResolver {
  private readonly logger = new Logger(ProviderCredentialService.name);
  private lifecycle: LifecycleOrchestrator | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialEncryptionService,
  ) {}

  /**
   * ProvidersModule wires this after construction to break the circular
   * import between credentials service and the lifecycle orchestrator
   * (which depends on per-provider lifecycle services).
   */
  setLifecycleOrchestrator(orchestrator: LifecycleOrchestrator): void {
    this.lifecycle = orchestrator;
  }

  async create(input: CreateCredentialInput) {
    this.assertCredentialMatchesProvider(input.provider, input.credentials);
    const encrypted = this.crypto.encrypt(input.credentials);

    const { externalAccountId, externalPhoneId, phoneNumber, webhookVerifyToken } =
      this.extractPublicIdentifiers(input.credentials);

    const row = await this.prisma.providerCredential.create({
      data: {
        tenantId: input.tenantId,
        instanceId: input.instanceId,
        provider: input.provider as unknown as $Enums.ProviderType,
        displayName: input.displayName,
        credentialsEncrypted: encrypted,
        externalAccountId,
        externalPhoneId,
        phoneNumber,
        webhookVerifyToken,
        webhookCallbackUrl: input.webhookCallbackUrl,
        expiresAt: input.expiresAt,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      { id: row.id, provider: input.provider, tenantId: input.tenantId },
      'provider.credential.created',
    );

    void this.lifecycle?.fireCreated(input.provider, {
      tenantId: input.tenantId,
      instanceId: input.instanceId ?? '',
      credentialId: row.id,
    });

    return this.toPublic(row);
  }

  async update(credentialId: string, input: UpdateCredentialInput) {
    const existing = await this.prisma.providerCredential.findUnique({
      where: { id: credentialId },
    });
    if (!existing) throw new NotFoundException(`Credential ${credentialId} not found`);

    const updates: Prisma.ProviderCredentialUpdateInput = {};
    if (input.displayName) updates.displayName = input.displayName;
    if (input.webhookCallbackUrl !== undefined) updates.webhookCallbackUrl = input.webhookCallbackUrl;
    if (input.status) updates.status = input.status;
    if (input.metadata) updates.metadata = input.metadata as Prisma.InputJsonValue;
    if (input.expiresAt !== undefined) updates.expiresAt = input.expiresAt;

    if (input.credentials) {
      this.assertCredentialMatchesProvider(existing.provider as ProviderType, input.credentials);
      updates.credentialsEncrypted = this.crypto.encrypt(input.credentials);
      const pub = this.extractPublicIdentifiers(input.credentials);
      updates.externalAccountId = pub.externalAccountId;
      updates.externalPhoneId = pub.externalPhoneId;
      updates.phoneNumber = pub.phoneNumber;
      updates.webhookVerifyToken = pub.webhookVerifyToken;
      updates.lastRotatedAt = new Date();
    }

    const row = await this.prisma.providerCredential.update({
      where: { id: credentialId },
      data: updates,
    });

    this.logger.log(
      { id: row.id, provider: row.provider, tenantId: row.tenantId, rotated: Boolean(input.credentials) },
      'provider.credential.updated',
    );

    if (input.credentials) {
      void this.lifecycle?.fireRotated(row.provider as unknown as ProviderType, {
        tenantId: row.tenantId,
        instanceId: row.instanceId ?? '',
        credentialId: row.id,
      });
    }

    return this.toPublic(row);
  }

  async delete(credentialId: string): Promise<void> {
    const existing = await this.prisma.providerCredential.findUnique({
      where: { id: credentialId },
    });
    await this.prisma.providerCredential.delete({ where: { id: credentialId } });
    this.logger.log({ id: credentialId }, 'provider.credential.deleted');

    if (existing) {
      void this.lifecycle?.fireRevoked(existing.provider as unknown as ProviderType, {
        tenantId: existing.tenantId,
        instanceId: existing.instanceId ?? '',
        credentialId,
      });
    }
  }

  async list(tenantId: string, filters: { provider?: ProviderType; instanceId?: string } = {}) {
    const rows = await this.prisma.providerCredential.findMany({
      where: {
        tenantId,
        provider: filters.provider as unknown as $Enums.ProviderType | undefined,
        instanceId: filters.instanceId,
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toPublic(r));
  }

  async findById(tenantId: string, credentialId: string) {
    const row = await this.prisma.providerCredential.findFirst({
      where: { id: credentialId, tenantId },
    });
    if (!row) throw new NotFoundException(`Credential ${credentialId} not found`);
    return this.toPublic(row);
  }

  // ─── CredentialResolver implementation ─────────────────

  async resolve(credentialId: string): Promise<ProviderCredentialData> {
    const row = await this.prisma.providerCredential.findUnique({
      where: { id: credentialId },
    });
    if (!row) throw new NotFoundException(`Credential ${credentialId} not found`);
    if (row.status !== 'ACTIVE') {
      throw new Error(`Credential ${credentialId} is not active (status=${row.status})`);
    }
    return this.crypto.decrypt(row.credentialsEncrypted);
  }

  async resolveMetaWhatsApp(credentialId: string): Promise<MetaWhatsAppCloudCredentials> {
    const data = await this.resolve(credentialId);
    if (data.type !== ProviderType.META_WHATSAPP_CLOUD) {
      throw new Error(`Credential ${credentialId} is not a Meta WhatsApp Cloud credential`);
    }
    return data;
  }

  async resolveMetaInstagram(credentialId: string): Promise<MetaInstagramCredentials> {
    const data = await this.resolve(credentialId);
    if (data.type !== ProviderType.META_INSTAGRAM) {
      throw new Error(`Credential ${credentialId} is not a Meta Instagram credential`);
    }
    return data;
  }

  async resolveMetaMessenger(credentialId: string): Promise<MetaMessengerCredentials> {
    const data = await this.resolve(credentialId);
    if (data.type !== ProviderType.META_MESSENGER) {
      throw new Error(`Credential ${credentialId} is not a Meta Messenger credential`);
    }
    return data;
  }

  async resolveTwilio(
    credentialId: string,
    expectedType?: ProviderType,
  ): Promise<TwilioCredentials> {
    const data = await this.resolve(credentialId);
    if (!isTwilioCredentials(data)) {
      throw new Error(`Credential ${credentialId} is not a Twilio credential`);
    }
    if (expectedType && data.type !== expectedType) {
      throw new Error(`Credential ${credentialId} provider mismatch: expected ${expectedType}`);
    }
    return data;
  }

  async findByExternalPhoneId(phoneNumberId: string) {
    const row = await this.prisma.providerCredential.findFirst({
      where: {
        externalPhoneId: phoneNumberId,
        provider: ProviderType.META_WHATSAPP_CLOUD as unknown as $Enums.ProviderType,
        status: 'ACTIVE',
      },
    });
    if (!row) return null;
    return {
      credentialId: row.id,
      tenantId: row.tenantId,
      instanceId: row.instanceId,
      provider: row.provider as unknown as ProviderType,
    };
  }

  async findByPageId(pageId: string) {
    const row = await this.prisma.providerCredential.findFirst({
      where: {
        externalAccountId: pageId,
        provider: {
          in: [ProviderType.META_INSTAGRAM, ProviderType.META_MESSENGER] as unknown as $Enums.ProviderType[],
        },
        status: 'ACTIVE',
      },
    });
    if (!row) return null;
    return {
      credentialId: row.id,
      tenantId: row.tenantId,
      instanceId: row.instanceId,
      provider: row.provider as unknown as ProviderType,
    };
  }

  async findByAccountSid(accountSid: string) {
    const row = await this.prisma.providerCredential.findFirst({
      where: {
        externalAccountId: accountSid,
        provider: {
          in: [
            ProviderType.TWILIO_SMS,
            ProviderType.TWILIO_WHATSAPP,
            ProviderType.TWILIO_VOICE,
            ProviderType.TWILIO_VERIFY,
          ] as unknown as $Enums.ProviderType[],
        },
        status: 'ACTIVE',
      },
    });
    if (!row) return null;
    return {
      credentialId: row.id,
      tenantId: row.tenantId,
      instanceId: row.instanceId,
      provider: row.provider as unknown as ProviderType,
    };
  }

  async touch(credentialId: string): Promise<void> {
    await this.prisma.providerCredential
      .update({
        where: { id: credentialId },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});
  }

  // ─── Helpers ────────────────────────────────────────────

  private assertCredentialMatchesProvider(
    provider: ProviderType,
    data: ProviderCredentialData,
  ): void {
    if (provider === ProviderType.META_WHATSAPP_CLOUD && data.type !== ProviderType.META_WHATSAPP_CLOUD) {
      throw new Error('Credential shape does not match META_WHATSAPP_CLOUD');
    }
    if (provider === ProviderType.META_INSTAGRAM && data.type !== ProviderType.META_INSTAGRAM) {
      throw new Error('Credential shape does not match META_INSTAGRAM');
    }
    if (provider === ProviderType.META_MESSENGER && data.type !== ProviderType.META_MESSENGER) {
      throw new Error('Credential shape does not match META_MESSENGER');
    }
    if (isTwilioCredentials(data) && data.type !== provider) {
      throw new Error(`Credential shape does not match ${provider}`);
    }
  }

  private extractPublicIdentifiers(data: ProviderCredentialData): {
    externalAccountId?: string;
    externalPhoneId?: string;
    phoneNumber?: string;
    webhookVerifyToken?: string;
  } {
    if (isMetaCredentials(data)) {
      if (data.type === ProviderType.META_WHATSAPP_CLOUD) {
        return {
          externalAccountId: data.businessAccountId,
          externalPhoneId: data.phoneNumberId,
          webhookVerifyToken: data.webhookVerifyToken,
        };
      }
      if (data.type === ProviderType.META_INSTAGRAM) {
        return {
          externalAccountId: data.pageId,
          externalPhoneId: data.instagramBusinessAccountId,
          webhookVerifyToken: data.webhookVerifyToken,
        };
      }
      return {
        externalAccountId: data.pageId,
        webhookVerifyToken: data.webhookVerifyToken,
      };
    }
    if (isTwilioCredentials(data)) {
      return {
        externalAccountId: data.accountSid,
        phoneNumber: data.fromNumber,
      };
    }
    return {};
  }

  private toPublic(row: {
    id: string;
    tenantId: string;
    instanceId: string | null;
    provider: string;
    displayName: string;
    externalAccountId: string | null;
    externalPhoneId: string | null;
    phoneNumber: string | null;
    webhookCallbackUrl: string | null;
    status: string;
    lastUsedAt: Date | null;
    lastRotatedAt: Date | null;
    expiresAt: Date | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      instanceId: row.instanceId,
      provider: row.provider,
      displayName: row.displayName,
      externalAccountId: row.externalAccountId,
      externalPhoneId: row.externalPhoneId,
      phoneNumber: row.phoneNumber,
      webhookCallbackUrl: row.webhookCallbackUrl,
      status: row.status,
      lastUsedAt: row.lastUsedAt,
      lastRotatedAt: row.lastRotatedAt,
      expiresAt: row.expiresAt,
      metadata: row.metadata,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

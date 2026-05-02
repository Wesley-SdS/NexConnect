import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  MetaWhatsAppCloudCredentials,
  ProviderContext,
  ProviderType,
} from '@nexconnect/core';
import { PrismaService } from '@nexconnect/database';
import { Prisma } from '@prisma/client';
import {
  CREDENTIAL_RESOLVER,
  CredentialResolver,
} from '../../providers/credential.resolver';
import { GraphTemplate } from '../types/graph-api.types';
import { WhatsAppCloudClient } from './whatsapp-cloud.client';

export interface CreateTemplateRequest {
  name: string;
  language: string;
  category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
  components: GraphTemplate['components'];
}

@Injectable()
export class WhatsAppTemplateService {
  private readonly logger = new Logger(WhatsAppTemplateService.name);

  constructor(
    private readonly client: WhatsAppCloudClient,
    private readonly prisma: PrismaService,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  async syncTemplates(context: ProviderContext): Promise<{ synced: number }> {
    const creds = await this.credentials.resolveMetaWhatsApp(context.credentialId);
    const config = this.toClientConfig(creds);

    let after: string | undefined;
    let synced = 0;

    do {
      const page = await this.client.listTemplates(config, { limit: 100, after });
      for (const tpl of page.data) {
        await this.upsertLocal(context, tpl);
        synced++;
      }
      after = page.paging?.cursors?.after;
      if (!page.paging?.next) break;
    } while (after);

    this.logger.log(
      { tenantId: context.tenantId, credentialId: context.credentialId, synced },
      'meta.whatsapp.templates.synced',
    );
    return { synced };
  }

  async listLocal(tenantId: string, credentialId: string) {
    return this.prisma.messageTemplate.findMany({
      where: { tenantId, credentialId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createTemplate(
    context: ProviderContext,
    input: CreateTemplateRequest,
  ): Promise<{ id: string; status: string; category: string; localId: string }> {
    const creds = await this.credentials.resolveMetaWhatsApp(context.credentialId);
    const created = await this.client.createTemplate(this.toClientConfig(creds), input);
    const local = await this.upsertLocal(context, {
      id: created.id,
      name: input.name,
      language: input.language,
      category: input.category,
      status: created.status as GraphTemplate['status'],
      components: input.components,
    });
    return { ...created, localId: local.id };
  }

  async deleteTemplate(context: ProviderContext, templateName: string): Promise<void> {
    const creds = await this.credentials.resolveMetaWhatsApp(context.credentialId);
    await this.client.deleteTemplate(this.toClientConfig(creds), templateName);
    await this.prisma.messageTemplate.deleteMany({
      where: { tenantId: context.tenantId, credentialId: context.credentialId, name: templateName },
    });
  }

  async getByName(
    tenantId: string,
    credentialId: string,
    name: string,
    language: string,
  ) {
    const row = await this.prisma.messageTemplate.findFirst({
      where: { tenantId, credentialId, name, language },
    });
    if (!row) throw new NotFoundException(`Template not found: ${name} (${language})`);
    return row;
  }

  private async upsertLocal(context: ProviderContext, tpl: GraphTemplate) {
    return this.prisma.messageTemplate.upsert({
      where: {
        credentialId_name_language: {
          credentialId: context.credentialId,
          name: tpl.name,
          language: tpl.language,
        },
      },
      create: {
        tenantId: context.tenantId,
        credentialId: context.credentialId,
        externalTemplateId: tpl.id,
        name: tpl.name,
        language: tpl.language,
        category: tpl.category as 'AUTHENTICATION' | 'MARKETING' | 'UTILITY',
        status: (tpl.status ?? 'PENDING') as
          | 'PENDING'
          | 'APPROVED'
          | 'REJECTED'
          | 'PAUSED'
          | 'DISABLED',
        components: tpl.components as unknown as Prisma.InputJsonValue,
        rejectionReason: tpl.rejected_reason,
      },
      update: {
        externalTemplateId: tpl.id,
        category: tpl.category as 'AUTHENTICATION' | 'MARKETING' | 'UTILITY',
        status: (tpl.status ?? 'PENDING') as
          | 'PENDING'
          | 'APPROVED'
          | 'REJECTED'
          | 'PAUSED'
          | 'DISABLED',
        components: tpl.components as unknown as Prisma.InputJsonValue,
        rejectionReason: tpl.rejected_reason,
      },
    });
  }

  private toClientConfig(creds: MetaWhatsAppCloudCredentials) {
    return {
      accessToken: creds.accessToken,
      phoneNumberId: creds.phoneNumberId,
      businessAccountId: creds.businessAccountId,
      apiVersion: creds.graphApiVersion,
    };
  }

  get providerType(): ProviderType {
    return ProviderType.META_WHATSAPP_CLOUD;
  }
}

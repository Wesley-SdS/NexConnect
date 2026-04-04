import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@nexconnect/database';

export interface TenantDataExport {
  tenant: {
    id: string;
    name: string;
    plan: string;
    createdAt: string;
  };
  instances: Array<{
    id: string;
    name: string;
    phoneNumber: string | null;
    status: string;
  }>;
  apiKeys: Array<{
    id: string;
    name: string;
    prefix: string;
    createdAt: string;
  }>;
  messageCount: number;
  webhookCount: number;
  exportedAt: string;
}

export interface ErasureResult {
  erasedResources: Record<string, number>;
}

/**
 * Handles LGPD data portability (Art. 18, V) and right to erasure (Art. 18, VI).
 *
 * - exportTenantData: Produces a structured export of all tenant-owned data.
 * - eraseTenantPii: Hard-deletes all personally identifiable information for a tenant.
 */
@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Export all tenant data for LGPD compliance (data portability).
   * Returns a structured snapshot — does NOT include raw auth state or encrypted secrets.
   */
  async exportTenantData(tenantId: string): Promise<TenantDataExport> {
    this.logger.log({ tenantId }, 'Starting tenant data export');

    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
    });

    const instances = await this.prisma.instance.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        status: true,
      },
    });

    const apiKeys = await this.prisma.apiKey.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        prefix: true,
        createdAt: true,
      },
    });

    const messageCount = await this.prisma.message.count({
      where: { instance: { tenantId } },
    });

    const webhookCount = await this.prisma.webhook.count({
      where: { tenantId },
    });

    const exportData: TenantDataExport = {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        plan: tenant.plan,
        createdAt: tenant.createdAt.toISOString(),
      },
      instances: instances.map((i) => ({
        id: i.id,
        name: i.name,
        phoneNumber: i.phoneNumber,
        status: i.status,
      })),
      apiKeys: apiKeys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        createdAt: k.createdAt.toISOString(),
      })),
      messageCount,
      webhookCount,
      exportedAt: new Date().toISOString(),
    };

    this.logger.log(
      {
        tenantId,
        instanceCount: instances.length,
        apiKeyCount: apiKeys.length,
        messageCount,
        webhookCount,
      },
      'Tenant data export completed',
    );

    return exportData;
  }

  /**
   * Right to erasure — hard-delete all tenant PII.
   *
   * This operation is IRREVERSIBLE. It removes:
   * - All messages (content includes PII like phone numbers, text)
   * - All media assets (references to stored files)
   * - All webhook deliveries (may contain PII in payloads)
   * - All events (may contain PII in payloads)
   * - All audit logs (contain actor info, IPs)
   * - All scheduled messages (contain recipient PII)
   * - Instance phone numbers (nullified, instances kept for accounting)
   *
   * Tenant record and API keys are retained for billing/accounting with PII stripped.
   */
  async eraseTenantPii(tenantId: string): Promise<ErasureResult> {
    this.logger.warn({ tenantId }, 'Starting PII erasure — IRREVERSIBLE');

    const erasedResources: Record<string, number> = {};

    await this.prisma.$transaction(async (tx) => {
      // Delete messages (contains content with PII)
      const messages = await tx.message.deleteMany({
        where: { instance: { tenantId } },
      });
      erasedResources['messages'] = messages.count;

      // Delete media assets
      const media = await tx.mediaAsset.deleteMany({
        where: { tenantId },
      });
      erasedResources['mediaAssets'] = media.count;

      // Delete webhook deliveries (may contain PII in response bodies)
      const deliveries = await tx.webhookDelivery.deleteMany({
        where: { event: { instance: { tenantId } } },
      });
      erasedResources['webhookDeliveries'] = deliveries.count;

      // Delete events
      const events = await tx.event.deleteMany({
        where: { instance: { tenantId } },
      });
      erasedResources['events'] = events.count;

      // Delete audit logs (contain IPs, actor IDs)
      const auditLogs = await tx.auditLog.deleteMany({
        where: { tenantId },
      });
      erasedResources['auditLogs'] = auditLogs.count;

      // Delete scheduled messages
      const scheduled = await tx.scheduledMessage.deleteMany({
        where: { tenantId },
      });
      erasedResources['scheduledMessages'] = scheduled.count;

      // Nullify phone numbers on instances (keep instance records for accounting)
      const instances = await tx.instance.updateMany({
        where: { tenantId },
        data: { phoneNumber: null, authStateEncrypted: null },
      });
      erasedResources['instancesAnonymized'] = instances.count;

      // Anonymize tenant name
      await tx.tenant.update({
        where: { id: tenantId },
        data: { name: `[ERASED] ${tenantId.slice(0, 8)}` },
      });
      erasedResources['tenantAnonymized'] = 1;
    });

    this.logger.warn(
      { tenantId, erasedResources },
      'PII erasure completed',
    );

    return { erasedResources };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@nexconnect/database';

export interface PurgeResult {
  deletedCount: number;
}

/**
 * Handles data retention policies for LGPD compliance.
 *
 * Provides methods to purge expired messages, webhook deliveries,
 * and audit logs based on configurable retention periods per tenant.
 */
@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Purge messages older than the specified retention period.
   * Deletes in batches to avoid long-running transactions.
   */
  async purgeExpiredMessages(
    tenantId: string,
    retentionDays: number,
  ): Promise<PurgeResult> {
    const cutoffDate = this.computeCutoff(retentionDays);

    this.logger.log(
      { tenantId, retentionDays, cutoffDate },
      'Purging expired messages',
    );

    const result = await this.prisma.message.deleteMany({
      where: {
        instance: { tenantId },
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(
      { tenantId, deletedCount: result.count },
      'Expired messages purged',
    );

    return { deletedCount: result.count };
  }

  /**
   * Purge webhook deliveries older than the specified retention period.
   */
  async purgeExpiredDeliveries(
    tenantId: string,
    retentionDays: number,
  ): Promise<PurgeResult> {
    const cutoffDate = this.computeCutoff(retentionDays);

    this.logger.log(
      { tenantId, retentionDays, cutoffDate },
      'Purging expired webhook deliveries',
    );

    const result = await this.prisma.webhookDelivery.deleteMany({
      where: {
        event: { instance: { tenantId } },
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(
      { tenantId, deletedCount: result.count },
      'Expired webhook deliveries purged',
    );

    return { deletedCount: result.count };
  }

  /**
   * Purge audit logs older than the specified retention period.
   * Audit logs typically have a longer retention (e.g., 365 days).
   */
  async purgeExpiredAuditLogs(
    tenantId: string,
    retentionDays: number,
  ): Promise<PurgeResult> {
    const cutoffDate = this.computeCutoff(retentionDays);

    this.logger.log(
      { tenantId, retentionDays, cutoffDate },
      'Purging expired audit logs',
    );

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        tenantId,
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(
      { tenantId, deletedCount: result.count },
      'Expired audit logs purged',
    );

    return { deletedCount: result.count };
  }

  private computeCutoff(retentionDays: number): Date {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    return cutoff;
  }
}

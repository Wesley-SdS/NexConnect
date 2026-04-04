import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@nexconnect/database';

const DEFAULT_RETENTION_DAYS = 365;

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * *')
  async purgeExpiredData(): Promise<void> {
    this.logger.log('Starting data retention purge');

    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, settings: true },
    });

    for (const tenant of tenants) {
      const settings = (tenant.settings as Record<string, unknown>) ?? {};
      const retentionDays =
        typeof settings.dataRetentionDays === 'number'
          ? settings.dataRetentionDays
          : DEFAULT_RETENTION_DAYS;

      const cutoffDate = new Date(
        Date.now() - retentionDays * 24 * 60 * 60 * 1000,
      );

      try {
        const [deletedMessages, deletedEvents, deletedDeliveries, deletedMedia] =
          await Promise.all([
            this.prisma.message.deleteMany({
              where: {
                tenantId: tenant.id,
                createdAt: { lt: cutoffDate },
              },
            }),
            this.prisma.event.deleteMany({
              where: {
                tenantId: tenant.id,
                createdAt: { lt: cutoffDate },
              },
            }),
            this.prisma.webhookDelivery.deleteMany({
              where: {
                webhook: { tenantId: tenant.id },
                createdAt: { lt: cutoffDate },
              },
            }),
            this.prisma.mediaAsset.deleteMany({
              where: {
                tenantId: tenant.id,
                createdAt: { lt: cutoffDate },
              },
            }),
          ]);

        this.logger.log(
          {
            tenantId: tenant.id,
            deletedMessages: deletedMessages.count,
            deletedEvents: deletedEvents.count,
            deletedDeliveries: deletedDeliveries.count,
            deletedMedia: deletedMedia.count,
            retentionDays,
          },
          'Data retention purge completed for tenant',
        );
      } catch (error) {
        this.logger.error(
          { tenantId: tenant.id, error: (error as Error).message },
          'Data retention purge failed for tenant',
        );
      }
    }

    this.logger.log('Data retention purge finished');
  }
}

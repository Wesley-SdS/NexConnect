import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '@nexconnect/database';
import { RedisModule } from '@nexconnect/redis';
import { InstancesController } from './instances.controller';
import { InstancesService } from './instances.service';
import { InstanceLifecycleService } from './instance-lifecycle.service';
import { InstanceMetricsService } from './instance-metrics.service';
import { InstanceSettingsService } from './instance-settings.service';
import { QrCodeService } from './qrcode.service';
import { BlacklistController } from './blacklist.controller';
import { BlacklistService } from './blacklist.service';
import { PresenceController } from './presence.controller';
import { StoriesController } from './stories.controller';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    BullModule.registerQueue(
      { name: 'instance-lifecycle' },
      { name: 'instance-health' },
    ),
    forwardRef(() => WebhooksModule),
  ],
  controllers: [
    InstancesController,
    PresenceController,
    StoriesController,
    BlacklistController,
  ],
  providers: [
    InstancesService,
    InstanceLifecycleService,
    InstanceMetricsService,
    InstanceSettingsService,
    QrCodeService,
    BlacklistService,
  ],
  exports: [InstancesService, InstanceLifecycleService, InstanceMetricsService, BlacklistService],
})
export class InstancesModule {}

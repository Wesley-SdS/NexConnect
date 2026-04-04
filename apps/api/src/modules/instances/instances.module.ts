import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '@nexconnect/database';
import { RedisModule } from '@nexconnect/redis';
import { InstancesController } from './instances.controller';
import { InstancesService } from './instances.service';
import { InstanceSettingsService } from './instance-settings.service';
import { PresenceController } from './presence.controller';
import { StoriesController } from './stories.controller';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    BullModule.registerQueue(
      { name: 'instance-lifecycle' },
      { name: 'instance-health' },
    ),
  ],
  controllers: [InstancesController, PresenceController, StoriesController],
  providers: [InstancesService, InstanceSettingsService],
  exports: [InstancesService],
})
export class InstancesModule {}

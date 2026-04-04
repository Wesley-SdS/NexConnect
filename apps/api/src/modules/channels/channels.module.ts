import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '@nexconnect/database';
import { RedisModule } from '@nexconnect/redis';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { InstancesModule } from '../instances/instances.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    InstancesModule,
    BullModule.registerQueue({ name: 'channels' }),
  ],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}

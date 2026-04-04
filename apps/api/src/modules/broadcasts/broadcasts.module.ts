import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '@nexconnect/database';
import { BroadcastsController } from './broadcasts.controller';
import { BroadcastsService } from './broadcasts.service';
import { InstancesModule } from '../instances/instances.module';

@Module({
  imports: [
    DatabaseModule,
    InstancesModule,
    BullModule.registerQueue({ name: 'broadcast-messages' }),
  ],
  controllers: [BroadcastsController],
  providers: [BroadcastsService],
  exports: [BroadcastsService],
})
export class BroadcastsModule {}

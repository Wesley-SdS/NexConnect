import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '@nexconnect/database';
import { SchedulingController } from './scheduling.controller';
import { SchedulingService } from './scheduling.service';
import { InstancesModule } from '../instances/instances.module';

@Module({
  imports: [
    DatabaseModule,
    InstancesModule,
    BullModule.registerQueue({ name: 'scheduled-messages' }),
  ],
  controllers: [SchedulingController],
  providers: [SchedulingService],
  exports: [SchedulingService],
})
export class SchedulingModule {}

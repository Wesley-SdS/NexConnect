import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '@nexconnect/database';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { InstancesModule } from '../instances/instances.module';

@Module({
  imports: [
    DatabaseModule,
    InstancesModule,
    BullModule.registerQueue({ name: 'group-operations' }),
  ],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}

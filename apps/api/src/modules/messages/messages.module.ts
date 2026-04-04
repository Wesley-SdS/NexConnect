import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '@nexconnect/database';
import { RedisModule } from '@nexconnect/redis';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { OutboundPipelineService } from './outbound-pipeline.service';
import { InstancesModule } from '../instances/instances.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    InstancesModule,
    BullModule.registerQueue({ name: 'outbound-messages' }),
  ],
  controllers: [MessagesController],
  providers: [MessagesService, OutboundPipelineService],
  exports: [MessagesService],
})
export class MessagesModule {}

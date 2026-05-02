import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '@nexconnect/database';
import { RedisModule } from '@nexconnect/redis';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { ReactionsController } from './reactions.controller';
import { ReactionsService } from './reactions.service';
import { OutboundPipelineService } from './outbound-pipeline.service';
import {
  ValidationStage,
  PhoneVerificationStage,
  AntiSpamStage,
  MediaPreparationStage,
} from './stages';
import { InstancesModule } from '../instances/instances.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    InstancesModule,
    WebhooksModule,
    ProvidersModule,
    BullModule.registerQueue({ name: 'outbound-messages' }),
  ],
  controllers: [MessagesController, ReactionsController],
  providers: [
    MessagesService,
    ReactionsService,
    ValidationStage,
    PhoneVerificationStage,
    AntiSpamStage,
    MediaPreparationStage,
    OutboundPipelineService,
  ],
  exports: [MessagesService],
})
export class MessagesModule {}

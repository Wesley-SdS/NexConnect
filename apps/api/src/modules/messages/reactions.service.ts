import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@nexconnect/database';
import { UlidUtil } from '@nexconnect/shared';
import { WebhookEvent } from '@nexconnect/core';
import { InstancesService } from '../instances/instances.service';
import { WebhookDispatchService } from '../webhooks/webhook-dispatch.service';

interface AddReactionDto {
  emoji: string;
}

@Injectable()
export class ReactionsService {
  private readonly logger = new Logger(ReactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly instancesService: InstancesService,
    private readonly webhookDispatch: WebhookDispatchService,
    @InjectQueue('outbound-messages')
    private readonly outboundQueue: Queue,
  ) {}

  async addReaction(
    tenantId: string,
    instanceId: string,
    msgId: string,
    dto: AddReactionDto,
  ) {
    await this.instancesService.findOne(tenantId, instanceId);

    const targetMessage = await this.prisma.message.findFirst({
      where: { id: msgId, instanceId },
    });

    if (!targetMessage) {
      throw new NotFoundException(`Message ${msgId} not found`);
    }

    const reactionId = UlidUtil.generate();

    const reaction = await this.prisma.message.create({
      data: {
        id: reactionId,
        instanceId,
        tenantId,
        type: 'REACTION',
        direction: 'OUTBOUND',
        status: 'PENDING',
        content: {
          emoji: dto.emoji,
          targetMessageId: msgId,
          targetWaMessageId: targetMessage.waMessageId,
        },
      },
    });

    await this.outboundQueue.add(
      'send-reaction',
      {
        messageId: reactionId,
        instanceId,
        tenantId,
        targetWaMessageId: targetMessage.waMessageId,
        emoji: dto.emoji,
      },
      { jobId: reactionId },
    );

    this.logger.log(
      { reactionId, msgId, emoji: dto.emoji },
      'Reaction enqueued',
    );

    await this.webhookDispatch.dispatchEvent(
      instanceId,
      tenantId,
      WebhookEvent.MESSAGE_REACTION,
      {
        reactionId,
        messageId: msgId,
        emoji: dto.emoji,
        instanceId,
      },
    );

    return {
      reactionId: reaction.id,
      status: 'queued',
      emoji: dto.emoji,
    };
  }

  async removeReaction(
    tenantId: string,
    instanceId: string,
    msgId: string,
  ) {
    await this.instancesService.findOne(tenantId, instanceId);

    const targetMessage = await this.prisma.message.findFirst({
      where: { id: msgId, instanceId },
    });

    if (!targetMessage) {
      throw new NotFoundException(`Message ${msgId} not found`);
    }

    const reactionId = UlidUtil.generate();

    const reaction = await this.prisma.message.create({
      data: {
        id: reactionId,
        instanceId,
        tenantId,
        type: 'REACTION',
        direction: 'OUTBOUND',
        status: 'PENDING',
        content: {
          emoji: '',
          targetMessageId: msgId,
          targetWaMessageId: targetMessage.waMessageId,
          remove: true,
        },
      },
    });

    await this.outboundQueue.add(
      'send-reaction',
      {
        messageId: reactionId,
        instanceId,
        tenantId,
        targetWaMessageId: targetMessage.waMessageId,
        emoji: '',
        remove: true,
      },
      { jobId: reactionId },
    );

    this.logger.log(
      { reactionId, msgId },
      'Reaction removal enqueued',
    );

    return {
      reactionId: reaction.id,
      status: 'queued',
    };
  }
}

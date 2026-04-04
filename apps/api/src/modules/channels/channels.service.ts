import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import { PrismaService } from '@nexconnect/database';
import { UlidUtil } from '@nexconnect/shared';
import { InstancesService } from '../instances/instances.service';

interface PublishContentDto {
  content: {
    text?: string;
    media?: {
      type: string;
      url: string;
      caption?: string;
    };
  };
}

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly instancesService: InstancesService,
    @InjectQueue('channels')
    private readonly channelsQueue: Queue,
  ) {}

  async publish(
    tenantId: string,
    instanceId: string,
    dto: PublishContentDto,
  ) {
    await this.instancesService.findOne(tenantId, instanceId);

    const messageId = UlidUtil.generate();

    const message = await this.prisma.message.create({
      data: {
        id: messageId,
        instanceId,
        tenantId,
        type: dto.content.media ? 'IMAGE' : 'TEXT',
        direction: 'OUTBOUND',
        status: 'PENDING',
        content: {
          channel: true,
          ...dto.content,
        },
      },
    });

    await this.channelsQueue.add(
      'publish-channel',
      {
        messageId,
        instanceId,
        tenantId,
        content: dto.content,
      },
      { jobId: messageId },
    );

    this.logger.log(
      { messageId, instanceId },
      'Channel publication enqueued',
    );

    return {
      messageId: message.id,
      status: 'queued',
    };
  }

  async listChannels(tenantId: string, instanceId: string) {
    await this.instancesService.findOne(tenantId, instanceId);

    const job = await this.channelsQueue.add(
      'list-channels',
      {
        instanceId,
        tenantId,
      },
      {
        jobId: `list-channels:${instanceId}:${Date.now()}`,
      },
    );

    const queueEvents = new QueueEvents('channels');
    const result = await job.waitUntilFinished(
      queueEvents,
      30_000,
    );

    this.logger.log({ instanceId }, 'Channels listed');

    return {
      channels: result?.channels ?? [],
    };
  }
}

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@nexconnect/database';
import { UlidUtil } from '@nexconnect/shared';
import { InstancesService } from '../instances/instances.service';

@Injectable()
export class BroadcastsService {
  private readonly logger = new Logger(BroadcastsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly instancesService: InstancesService,
    @InjectQueue('broadcast-messages')
    private readonly broadcastQueue: Queue,
  ) {}

  async create(tenantId: string, data: {
    instanceIds: string[];
    recipients: string[];
    type: string;
    content: Record<string, any>;
    delayBetweenMs?: number;
  }) {
    if (!data.instanceIds.length) {
      throw new BadRequestException('At least one instance is required');
    }

    if (!data.recipients.length) {
      throw new BadRequestException('At least one recipient is required');
    }

    for (const instanceId of data.instanceIds) {
      await this.instancesService.findOne(tenantId, instanceId);
    }

    const id = UlidUtil.generate();

    const broadcast = await this.prisma.broadcast.create({
      data: {
        id,
        tenantId,
        instanceIds: data.instanceIds,
        totalRecipients: data.recipients.length,
        type: data.type,
        content: data.content as any,
        status: 'queued',
        sentCount: 0,
        failedCount: 0,
      },
    });

    const delayBetween = data.delayBetweenMs ?? 2000;

    for (let i = 0; i < data.recipients.length; i++) {
      const instanceId =
        data.instanceIds[i % data.instanceIds.length];

      await this.broadcastQueue.add(
        'send-broadcast-message',
        {
          broadcastId: id,
          instanceId,
          tenantId,
          to: data.recipients[i],
          type: data.type,
          content: data.content,
          index: i,
        },
        {
          delay: i * delayBetween,
          jobId: `${id}-${i}`,
        },
      );
    }

    this.logger.log(
      {
        broadcastId: id,
        recipients: data.recipients.length,
        instances: data.instanceIds.length,
      },
      'Broadcast created',
    );

    return broadcast;
  }

  async findAll(tenantId: string, page: number, limit: number) {
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    const [broadcasts, total] = await Promise.all([
      this.prisma.broadcast.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.broadcast.count({ where: { tenantId } }),
    ]);

    return {
      broadcasts,
      pagination: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, tenantId },
    });

    if (!broadcast) {
      throw new NotFoundException(`Broadcast ${id} not found`);
    }

    return broadcast;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@nexconnect/database';
import { UlidUtil } from '@nexconnect/shared';
import { SendMessageDto } from '@nexconnect/core';
import { InstancesService } from '../instances/instances.service';

interface FindAllOptions {
  page: number;
  limit: number;
  direction?: string;
  status?: string;
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly instancesService: InstancesService,
    @InjectQueue('outbound-messages')
    private readonly outboundQueue: Queue,
  ) {}

  async send(tenantId: string, instanceId: string, dto: SendMessageDto) {
    await this.instancesService.findOne(tenantId, instanceId);

    const messageId = UlidUtil.generate();

    const message = await this.prisma.message.create({
      data: {
        id: messageId,
        instanceId,
        to: dto.to,
        type: dto.type,
        content: dto.content as any,
        direction: 'outbound',
        status: 'queued',
      },
    });

    await this.outboundQueue.add(
      'send',
      {
        messageId,
        instanceId,
        tenantId,
        to: dto.to,
        type: dto.type,
        content: dto.content,
      },
      { jobId: messageId },
    );

    return {
      messageId: message.id,
      status: 'queued',
    };
  }

  async findAll(
    tenantId: string,
    instanceId: string,
    options: FindAllOptions,
  ) {
    await this.instancesService.findOne(tenantId, instanceId);

    const where: any = { instanceId };

    if (options.direction) {
      where.direction = options.direction;
    }

    if (options.status) {
      where.status = options.status;
    }

    const take = Math.min(options.limit, 100);
    const skip = (options.page - 1) * take;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.message.count({ where }),
    ]);

    return {
      messages,
      pagination: {
        page: options.page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async findOne(tenantId: string, instanceId: string, msgId: string) {
    await this.instancesService.findOne(tenantId, instanceId);

    const message = await this.prisma.message.findFirst({
      where: { id: msgId, instanceId },
    });

    if (!message) {
      throw new NotFoundException(`Message ${msgId} not found`);
    }

    return message;
  }
}

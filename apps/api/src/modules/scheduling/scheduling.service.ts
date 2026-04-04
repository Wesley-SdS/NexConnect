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
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly instancesService: InstancesService,
    @InjectQueue('scheduled-messages')
    private readonly scheduledQueue: Queue,
  ) {}

  async createScheduledMessage(tenantId: string, data: {
    instanceId: string;
    to: string;
    type: string;
    content: Record<string, any>;
    scheduledAt: string;
  }) {
    await this.instancesService.findOne(tenantId, data.instanceId);

    const scheduledAt = new Date(data.scheduledAt);

    if (scheduledAt <= new Date()) {
      throw new BadRequestException('scheduledAt must be in the future');
    }

    const id = UlidUtil.generate();
    const delay = scheduledAt.getTime() - Date.now();

    const scheduled = await this.prisma.scheduledMessage.create({
      data: {
        id,
        instanceId: data.instanceId,
        to: data.to,
        type: data.type,
        content: data.content as any,
        scheduledAt,
        status: 'pending',
      },
    });

    await this.scheduledQueue.add(
      'send-scheduled',
      {
        scheduledMessageId: id,
        instanceId: data.instanceId,
        tenantId,
        to: data.to,
        type: data.type,
        content: data.content,
      },
      { jobId: id, delay },
    );

    this.logger.log({ id, scheduledAt: data.scheduledAt }, 'Scheduled message created');

    return scheduled;
  }

  async findAllScheduledMessages(tenantId: string, instanceId?: string) {
    const where: any = {
      instance: { tenantId },
      status: 'pending',
    };

    if (instanceId) {
      where.instanceId = instanceId;
    }

    return this.prisma.scheduledMessage.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findOneScheduledMessage(tenantId: string, id: string) {
    const scheduled = await this.prisma.scheduledMessage.findFirst({
      where: { id, instance: { tenantId } },
    });

    if (!scheduled) {
      throw new NotFoundException(`Scheduled message ${id} not found`);
    }

    return scheduled;
  }

  async updateScheduledMessage(
    tenantId: string,
    id: string,
    data: { scheduledAt?: string; content?: Record<string, any>; active?: boolean },
  ) {
    const existing = await this.findOneScheduledMessage(tenantId, id);

    if (existing.status !== 'pending') {
      throw new BadRequestException('Cannot update a non-pending scheduled message');
    }

    const updateData: any = {};

    if (data.content) {
      updateData.content = data.content;
    }

    if (data.scheduledAt) {
      const newDate = new Date(data.scheduledAt);

      if (newDate <= new Date()) {
        throw new BadRequestException('scheduledAt must be in the future');
      }

      updateData.scheduledAt = newDate;

      await this.scheduledQueue.remove(id);

      const delay = newDate.getTime() - Date.now();
      await this.scheduledQueue.add(
        'send-scheduled',
        {
          scheduledMessageId: id,
          instanceId: existing.instanceId,
          tenantId,
          to: existing.to,
          type: existing.type,
          content: data.content ?? existing.content,
        },
        { jobId: id, delay },
      );
    }

    if (data.active === false) {
      updateData.status = 'cancelled';
      await this.scheduledQueue.remove(id);
    }

    return this.prisma.scheduledMessage.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteScheduledMessage(tenantId: string, id: string) {
    await this.findOneScheduledMessage(tenantId, id);

    await this.scheduledQueue.remove(id);

    await this.prisma.scheduledMessage.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    return { message: 'Scheduled message cancelled' };
  }

  async createCronJob(tenantId: string, data: {
    instanceId: string;
    name: string;
    cronExpression: string;
    to: string;
    type: string;
    content: Record<string, any>;
  }) {
    await this.instancesService.findOne(tenantId, data.instanceId);

    const id = UlidUtil.generate();

    const cronJob = await this.prisma.cronJob.create({
      data: {
        id,
        instanceId: data.instanceId,
        name: data.name,
        cronExpression: data.cronExpression,
        to: data.to,
        type: data.type,
        content: data.content as any,
        active: true,
      },
    });

    await this.scheduledQueue.add(
      'cron-send',
      {
        cronJobId: id,
        instanceId: data.instanceId,
        tenantId,
        to: data.to,
        type: data.type,
        content: data.content,
      },
      {
        jobId: `cron-${id}`,
        repeat: { pattern: data.cronExpression },
      },
    );

    this.logger.log({ id, cron: data.cronExpression }, 'Cron job created');

    return cronJob;
  }

  async findAllCronJobs(tenantId: string, instanceId?: string) {
    const where: any = {
      instance: { tenantId },
      active: true,
    };

    if (instanceId) {
      where.instanceId = instanceId;
    }

    return this.prisma.cronJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteCronJob(tenantId: string, id: string) {
    const cronJob = await this.prisma.cronJob.findFirst({
      where: { id, instance: { tenantId } },
    });

    if (!cronJob) {
      throw new NotFoundException(`Cron job ${id} not found`);
    }

    await this.scheduledQueue.removeRepeatableByKey(`cron-send:cron-${id}:::${cronJob.cronExpression}`);

    await this.prisma.cronJob.update({
      where: { id },
      data: { active: false },
    });

    return { message: 'Cron job deactivated' };
  }
}

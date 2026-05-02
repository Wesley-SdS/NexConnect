import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { Prisma } from '@prisma/client';
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

    const sendAt = new Date(data.scheduledAt);

    if (sendAt <= new Date()) {
      throw new BadRequestException('scheduledAt must be in the future');
    }

    const id = UlidUtil.generate();
    const delay = sendAt.getTime() - Date.now();

    const scheduled = await this.prisma.scheduledMessage.create({
      data: {
        id,
        instanceId: data.instanceId,
        tenantId,
        payload: {
          to: data.to,
          type: data.type,
          content: data.content,
        },
        sendAt,
        status: 'SCHEDULED',
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
    const where: Prisma.ScheduledMessageWhereInput = {
      tenantId,
      status: 'SCHEDULED',
    };

    if (instanceId) {
      where.instanceId = instanceId;
    }

    return this.prisma.scheduledMessage.findMany({
      where,
      orderBy: { sendAt: 'asc' },
    });
  }

  async findOneScheduledMessage(tenantId: string, id: string) {
    const scheduled = await this.prisma.scheduledMessage.findFirst({
      where: { id, tenantId },
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

    if (existing.status !== 'SCHEDULED') {
      throw new BadRequestException('Cannot update a non-scheduled message');
    }

    const updateData: Prisma.ScheduledMessageUpdateInput = {};
    const existingPayload = existing.payload as Record<string, any>;

    if (data.content) {
      updateData.payload = {
        ...existingPayload,
        content: data.content,
      };
    }

    if (data.scheduledAt) {
      const newDate = new Date(data.scheduledAt);

      if (newDate <= new Date()) {
        throw new BadRequestException('scheduledAt must be in the future');
      }

      updateData.sendAt = newDate;

      await this.scheduledQueue.remove(id);

      const delay = newDate.getTime() - Date.now();
      await this.scheduledQueue.add(
        'send-scheduled',
        {
          scheduledMessageId: id,
          instanceId: existing.instanceId,
          tenantId,
          to: existingPayload.to,
          type: existingPayload.type,
          content: data.content ?? existingPayload.content,
        },
        { jobId: id, delay },
      );
    }

    if (data.active === false) {
      updateData.status = 'CANCELED';
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
      data: { status: 'CANCELED' },
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
        content: data.content as Prisma.InputJsonValue,
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
    const where: Prisma.CronJobWhereInput = {
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

  async createSmartSchedule(
    tenantId: string,
    data: {
      instanceId: string;
      to: string;
      type: string;
      content: Record<string, any>;
      scheduledAt: string;
      sendWindow?: {
        enabled: boolean;
        startHour: number;
        endHour: number;
        timezone: string;
      };
    },
  ) {
    await this.instancesService.findOne(tenantId, data.instanceId);

    let sendAt = new Date(data.scheduledAt);

    if (data.sendWindow?.enabled) {
      sendAt = this.adjustToSendWindow(sendAt, data.sendWindow);
    }

    if (sendAt <= new Date()) {
      throw new BadRequestException('scheduledAt must be in the future (after send window adjustment)');
    }

    const id = UlidUtil.generate();
    const delay = sendAt.getTime() - Date.now();

    const scheduled = await this.prisma.scheduledMessage.create({
      data: {
        id,
        instanceId: data.instanceId,
        tenantId,
        payload: {
          to: data.to,
          type: data.type,
          content: data.content,
        },
        sendAt,
        status: 'SCHEDULED',
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

    this.logger.log(
      {
        id,
        originalScheduledAt: data.scheduledAt,
        adjustedScheduledAt: sendAt.toISOString(),
        sendWindow: data.sendWindow,
      },
      'Smart scheduled message created',
    );

    return scheduled;
  }

  private adjustToSendWindow(
    scheduledAt: Date,
    sendWindow: {
      enabled: boolean;
      startHour: number;
      endHour: number;
      timezone: string;
    },
  ): Date {
    const hourFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: sendWindow.timezone,
      hour: 'numeric',
      hour12: false,
    });

    const minuteFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: sendWindow.timezone,
      minute: 'numeric',
    });

    const scheduledHour = parseInt(hourFormatter.format(scheduledAt), 10);
    const scheduledMinute = parseInt(minuteFormatter.format(scheduledAt), 10);
    const scheduledTimeDecimal = scheduledHour + scheduledMinute / 60;

    if (
      scheduledTimeDecimal >= sendWindow.startHour &&
      scheduledTimeDecimal < sendWindow.endHour
    ) {
      return scheduledAt;
    }

    const adjusted = new Date(scheduledAt);

    if (scheduledTimeDecimal >= sendWindow.endHour) {
      adjusted.setDate(adjusted.getDate() + 1);
    }

    const tzOffsetParts = new Intl.DateTimeFormat('en-US', {
      timeZone: sendWindow.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(adjusted);

    const parts: Record<string, string> = {};
    for (const part of tzOffsetParts) {
      parts[part.type] = part.value;
    }

    const targetDateStr = `${parts.year}-${parts.month}-${parts.day}T${String(sendWindow.startHour).padStart(2, '0')}:00:00`;

    const localDate = new Date(targetDateStr);

    const tzNowStr = new Intl.DateTimeFormat('en-US', {
      timeZone: sendWindow.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(localDate);

    const utcMs = localDate.getTime();
    const tzMs = new Date(tzNowStr).getTime();
    const offset = utcMs - tzMs;

    const resultMs = new Date(
      `${parts.year}-${parts.month}-${parts.day}T${String(sendWindow.startHour).padStart(2, '0')}:00:00Z`,
    ).getTime() + offset;

    return new Date(resultMs);
  }
}

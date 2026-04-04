import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@nexconnect/database';
import { RedisService } from '@nexconnect/redis';
import { UlidUtil, InstanceNotFoundException } from '@nexconnect/shared';
import {
  CreateInstanceDto,
  UpdateInstanceDto,
  UpdateProfileDto,
  CreateWebhookDto,
  UpdateWebhookDto,
} from '@nexconnect/core';

@Injectable()
export class InstancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectQueue('instance-lifecycle')
    private readonly lifecycleQueue: Queue,
  ) {}

  async create(tenantId: string, dto: CreateInstanceDto) {
    const id = UlidUtil.generate();

    const instance = await this.prisma.instance.create({
      data: {
        id,
        tenantId,
        name: dto.name,
        status: 'disconnected',
        settings: dto.settings ?? {},
      },
    });

    return instance;
  }

  async findAll(tenantId: string) {
    return this.prisma.instance.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const instance = await this.prisma.instance.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!instance) {
      throw new InstanceNotFoundException(id);
    }

    return instance;
  }

  async update(tenantId: string, id: string, dto: UpdateInstanceDto) {
    await this.findOne(tenantId, id);

    return this.prisma.instance.update({
      where: { id },
      data: dto,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    await this.lifecycleQueue.add('disconnect', {
      instanceId: id,
      tenantId,
    });

    return this.prisma.instance.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'disconnected' },
    });
  }

  async getQrCode(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    const qrCode = await this.redis.get(`instance:${id}:qrcode`);

    if (!qrCode) {
      throw new NotFoundException('QR code not available. Start the instance first.');
    }

    return { qrCode };
  }

  async getPairingCode(tenantId: string, id: string, phoneNumber: string) {
    await this.findOne(tenantId, id);

    await this.lifecycleQueue.add('request-pairing-code', {
      instanceId: id,
      tenantId,
      phoneNumber,
    });

    return { message: 'Pairing code requested. Check instance status.' };
  }

  async powerOn(tenantId: string, id: string) {
    const instance = await this.findOne(tenantId, id);

    await this.lifecycleQueue.add('connect', {
      instanceId: id,
      tenantId,
    });

    await this.prisma.instance.update({
      where: { id },
      data: { status: 'connecting' },
    });

    return { message: 'Instance is powering on', instanceId: instance.id };
  }

  async powerOff(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    await this.lifecycleQueue.add('disconnect', {
      instanceId: id,
      tenantId,
    });

    await this.prisma.instance.update({
      where: { id },
      data: { status: 'disconnected' },
    });

    return { message: 'Instance is powering off' };
  }

  async restart(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    await this.lifecycleQueue.add('restart', {
      instanceId: id,
      tenantId,
    });

    await this.prisma.instance.update({
      where: { id },
      data: { status: 'connecting' },
    });

    return { message: 'Instance is restarting' };
  }

  async updateProfile(tenantId: string, id: string, dto: UpdateProfileDto) {
    await this.findOne(tenantId, id);

    await this.lifecycleQueue.add('update-profile', {
      instanceId: id,
      tenantId,
      profile: dto,
    });

    return { message: 'Profile update requested' };
  }

  async getHealth(tenantId: string, id: string) {
    const instance = await this.findOne(tenantId, id);

    const cachedHealth = await this.redis.get(`instance:${id}:health`);

    if (cachedHealth) {
      return JSON.parse(cachedHealth);
    }

    return {
      instanceId: instance.id,
      status: instance.status,
      uptime: null,
      numberHealth: null,
    };
  }

  async getMetrics(tenantId: string, id: string, period?: string) {
    await this.findOne(tenantId, id);

    const cacheKey = `instance:${id}:metrics:${period ?? '24h'}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const since = this.calculateSinceDate(period ?? '24h');

    const [messagesSent, messagesReceived, messagesFailed] = await Promise.all([
      this.prisma.message.count({
        where: { instanceId: id, direction: 'outbound', createdAt: { gte: since } },
      }),
      this.prisma.message.count({
        where: { instanceId: id, direction: 'inbound', createdAt: { gte: since } },
      }),
      this.prisma.message.count({
        where: { instanceId: id, status: 'failed', createdAt: { gte: since } },
      }),
    ]);

    const metrics = {
      instanceId: id,
      period: period ?? '24h',
      messagesSent,
      messagesReceived,
      messagesFailed,
    };

    await this.redis.set(cacheKey, JSON.stringify(metrics), 'EX', 300);

    return metrics;
  }

  async createWebhook(tenantId: string, instanceId: string, dto: CreateWebhookDto) {
    await this.findOne(tenantId, instanceId);

    return this.prisma.webhook.create({
      data: {
        id: UlidUtil.generate(),
        instanceId,
        url: dto.url,
        events: dto.events,
        secret: dto.secret,
        active: true,
      },
    });
  }

  async updateWebhook(
    tenantId: string,
    instanceId: string,
    webhookId: string,
    dto: UpdateWebhookDto,
  ) {
    await this.findOne(tenantId, instanceId);

    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, instanceId },
    });

    if (!webhook) {
      throw new NotFoundException(`Webhook ${webhookId} not found`);
    }

    return this.prisma.webhook.update({
      where: { id: webhookId },
      data: dto,
    });
  }

  async deleteWebhook(tenantId: string, instanceId: string, webhookId: string) {
    await this.findOne(tenantId, instanceId);

    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, instanceId },
    });

    if (!webhook) {
      throw new NotFoundException(`Webhook ${webhookId} not found`);
    }

    await this.prisma.webhook.delete({ where: { id: webhookId } });

    return { message: 'Webhook deleted' };
  }

  async testWebhook(tenantId: string, instanceId: string, webhookId: string) {
    await this.findOne(tenantId, instanceId);

    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, instanceId },
    });

    if (!webhook) {
      throw new NotFoundException(`Webhook ${webhookId} not found`);
    }

    await this.lifecycleQueue.add('test-webhook', {
      webhookId,
      instanceId,
      tenantId,
    });

    return { message: 'Test webhook dispatched' };
  }

  private calculateSinceDate(period: string): Date {
    const now = new Date();
    const match = period.match(/^(\d+)(h|d|w)$/);

    if (!match) {
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const [, amount, unit] = match;
    const value = parseInt(amount, 10);

    const multipliers: Record<string, number> = {
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000,
    };

    return new Date(now.getTime() - value * multipliers[unit]);
  }
}

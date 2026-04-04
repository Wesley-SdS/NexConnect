import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@nexconnect/database';
import { UlidUtil, encryptWebhookSecret } from '@nexconnect/shared';
import { WebhookEvent } from '@nexconnect/core';
import { WebhookDispatchService } from './webhook-dispatch.service';
import { ReplayEventsDto } from './webhooks.controller';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatchService: WebhookDispatchService,
    @InjectQueue('webhook-dispatch')
    private readonly dispatchQueue: Queue,
  ) {}

  async findByInstance(instanceId: string) {
    return this.prisma.webhook.findMany({
      where: { instanceId, enabled: true },
    });
  }

  async create(instanceId: string, data: { url: string; events: string[]; secret?: string; tenantId: string; name: string }) {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    const secretEncrypted =
      data.secret && encryptionKey
        ? encryptWebhookSecret(data.secret, encryptionKey)
        : '';

    return this.prisma.webhook.create({
      data: {
        id: UlidUtil.generate(),
        instanceId,
        tenantId: data.tenantId,
        name: data.name,
        url: data.url,
        events: data.events,
        secretEncrypted,
        enabled: true,
      },
    });
  }

  async update(webhookId: string, data: { url?: string; events?: string[]; enabled?: boolean }) {
    return this.prisma.webhook.update({
      where: { id: webhookId },
      data,
    });
  }

  async remove(webhookId: string) {
    await this.prisma.webhook.delete({ where: { id: webhookId } });
    return { message: 'Webhook deleted' };
  }

  async testDispatch(webhookId: string) {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) {
      throw new NotFoundException(`Webhook ${webhookId} not found`);
    }

    const payload = this.dispatchService.buildPayload(
      WebhookEvent.INSTANCE_CONNECTED,
      webhook.instanceId,
      webhook.tenantId,
      { message: 'Test webhook dispatch' },
      { delivery_attempt: 1, replay: false },
    );

    await this.dispatchService.dispatch(webhook.id, payload);

    return { message: 'Test event dispatched' };
  }

  async replayEvents(tenantId: string, dto: ReplayEventsDto) {
    const where: Record<string, any> = {
      tenantId,
      createdAt: {
        gte: new Date(dto.from),
        lte: new Date(dto.to),
      },
    };

    if (dto.eventTypes?.length) {
      where.type = { in: dto.eventTypes };
    }

    if (dto.instanceId) {
      where.instanceId = dto.instanceId;
    }

    const events = await this.prisma.event.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 1000,
    });

    for (const event of events) {
      const payload = this.dispatchService.buildPayload(
        event.type as WebhookEvent,
        event.instanceId,
        event.tenantId,
        event.payload as Record<string, any>,
        { delivery_attempt: 1, replay: true },
      );

      if (dto.targetUrl) {
        await this.dispatchQueue.add('deliver', {
          eventId: event.id,
          url: dto.targetUrl,
          payload,
          attempt: 1,
        });
      } else {
        await this.dispatchService.dispatchToInstance(event.instanceId, payload);
      }
    }

    this.logger.log(
      {
        tenantId,
        replayed: events.length,
        from: dto.from,
        to: dto.to,
        eventTypes: dto.eventTypes,
        instanceId: dto.instanceId,
      },
      'events.replayed',
    );

    return { replayed: events.length };
  }
}

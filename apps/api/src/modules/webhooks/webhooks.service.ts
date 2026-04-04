import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@nexconnect/database';
import { UlidUtil } from '@nexconnect/shared';
import { WebhookDispatchService } from './webhook-dispatch.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatchService: WebhookDispatchService,
  ) {}

  async findByInstance(instanceId: string) {
    return this.prisma.webhook.findMany({
      where: { instanceId, active: true },
    });
  }

  async create(instanceId: string, data: { url: string; events: string[]; secret?: string }) {
    return this.prisma.webhook.create({
      data: {
        id: UlidUtil.generate(),
        instanceId,
        url: data.url,
        events: data.events,
        secret: data.secret,
        active: true,
      },
    });
  }

  async update(webhookId: string, data: { url?: string; events?: string[]; active?: boolean }) {
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

    await this.dispatchService.dispatch(webhook.id, {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: { message: 'Test webhook dispatch' },
    });

    return { message: 'Test event dispatched' };
  }

  async replayEvent(tenantId: string, eventId: string, webhookId: string) {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
      include: { instance: { select: { tenantId: true } } },
    });

    if (!webhook || webhook.instance.tenantId !== tenantId) {
      throw new NotFoundException(`Webhook ${webhookId} not found`);
    }

    const event = await this.prisma.webhookEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event ${eventId} not found`);
    }

    await this.dispatchService.dispatch(webhookId, event.payload as any);

    this.logger.log({ eventId, webhookId }, 'Event replayed');

    return { message: 'Event replay dispatched' };
  }
}

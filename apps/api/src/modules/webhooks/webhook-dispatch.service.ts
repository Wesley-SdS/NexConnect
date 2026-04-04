import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@nexconnect/database';
import { CryptoUtil, UlidUtil } from '@nexconnect/shared';

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, any>;
}

@Injectable()
export class WebhookDispatchService {
  private readonly logger = new Logger(WebhookDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('webhook-dispatch')
    private readonly dispatchQueue: Queue,
  ) {}

  async dispatch(webhookId: string, payload: WebhookPayload): Promise<void> {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook || !webhook.active) {
      this.logger.warn({ webhookId }, 'Webhook not found or inactive, skipping dispatch');
      return;
    }

    if (webhook.events.length > 0 && !webhook.events.includes(payload.event)) {
      return;
    }

    const eventId = UlidUtil.generate();
    const signature = webhook.secret
      ? CryptoUtil.hmacSign(JSON.stringify(payload), webhook.secret)
      : undefined;

    await this.prisma.webhookEvent.create({
      data: {
        id: eventId,
        webhookId,
        event: payload.event,
        payload: payload as any,
        status: 'pending',
      },
    });

    await this.dispatchQueue.add(
      'deliver',
      {
        eventId,
        webhookId,
        url: webhook.url,
        payload,
        signature,
        attempt: 1,
      },
      {
        jobId: eventId,
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    this.logger.log({ eventId, webhookId, event: payload.event }, 'Webhook dispatched');
  }

  async dispatchToInstance(instanceId: string, payload: WebhookPayload): Promise<void> {
    const webhooks = await this.prisma.webhook.findMany({
      where: { instanceId, active: true },
    });

    await Promise.all(
      webhooks.map((webhook) => this.dispatch(webhook.id, payload)),
    );
  }
}

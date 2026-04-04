import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@nexconnect/database';
import { RedisService } from '@nexconnect/redis';
import {
  CryptoUtil,
  UlidUtil,
  WEBHOOK_DELIVERY_RATE_LIMIT_PER_MIN,
  RATE_LIMIT_BACKOFF_MS,
} from '@nexconnect/shared';
import { WebhookEvent } from '@nexconnect/core';

export interface WebhookPayload {
  id: string;
  type: WebhookEvent;
  instance_id: string;
  tenant_id: string;
  created_at: string;
  data: Record<string, any>;
  meta: {
    delivery_attempt: number;
    replay: boolean;
  };
}

@Injectable()
export class WebhookDispatchService {
  private readonly logger = new Logger(WebhookDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectQueue('webhook-dispatch')
    private readonly dispatchQueue: Queue,
  ) {}

  buildPayload(
    eventType: WebhookEvent,
    instanceId: string,
    tenantId: string,
    data: Record<string, any>,
    meta?: { delivery_attempt?: number; replay?: boolean },
  ): WebhookPayload {
    return {
      id: UlidUtil.generate(),
      type: eventType,
      instance_id: instanceId,
      tenant_id: tenantId,
      created_at: new Date().toISOString(),
      data,
      meta: {
        delivery_attempt: meta?.delivery_attempt ?? 1,
        replay: meta?.replay ?? false,
      },
    };
  }

  buildHeaders(
    payload: WebhookPayload,
    secret: string,
  ): Record<string, string> {
    const payloadString = JSON.stringify(payload);
    const hmac = CryptoUtil.generateHmacSignature(payloadString, secret);

    return {
      'Content-Type': 'application/json',
      'X-NexConnect-Signature': `sha256=${hmac}`,
      'X-NexConnect-Event': payload.type,
      'X-NexConnect-Delivery-Id': payload.id,
      'X-NexConnect-Timestamp': payload.created_at,
      'User-Agent': 'NexConnect-Webhook/1.0',
    };
  }

  async dispatch(webhookId: string, payload: WebhookPayload): Promise<void> {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook || !webhook.enabled) {
      this.logger.warn(
        { webhookId },
        'Webhook not found or inactive, skipping dispatch',
      );
      return;
    }

    if (
      webhook.events.length > 0 &&
      !webhook.events.includes(payload.type)
    ) {
      return;
    }

    const eventId = payload.id;

    // Persist event BEFORE enqueuing
    await this.prisma.event.create({
      data: {
        id: eventId,
        tenantId: payload.tenant_id,
        instanceId: payload.instance_id,
        type: payload.type,
        payload: payload as unknown as import('@prisma/client').Prisma.JsonValue,
      },
    });

    this.logger.log(
      { eventId, webhookId, eventType: payload.type, instanceId: payload.instance_id },
      'Event persisted',
    );

    // Rate limit: max webhook deliveries per minute per tenant
    const deliveryRateKey = `rate:webhook:delivery:${payload.tenant_id}`;
    const deliveryCount = await this.redis.incrWithTtl(deliveryRateKey, 60);

    const signature = webhook.secretEncrypted
      ? CryptoUtil.generateHmacSignature(
          JSON.stringify(payload),
          webhook.secretEncrypted,
        )
      : undefined;

    const jobData = {
      eventId,
      webhookId,
      url: webhook.testMode && webhook.testUrl ? webhook.testUrl : webhook.url,
      payload,
      signature,
      attempt: 1,
    };

    if (deliveryCount > WEBHOOK_DELIVERY_RATE_LIMIT_PER_MIN) {
      this.logger.warn(
        { tenantId: payload.tenant_id, count: deliveryCount },
        'webhook.delivery.rate-limit.exceeded',
      );

      await this.dispatchQueue.add('deliver', jobData, {
        jobId: eventId,
        delay: RATE_LIMIT_BACKOFF_MS,
        attempts: webhook.retryMaxAttempts,
        backoff: {
          type: 'exponential',
          delay: Math.round(webhook.retryBackoffBase * 1000),
        },
      });
      return;
    }

    await this.dispatchQueue.add('deliver', jobData, {
      jobId: eventId,
      attempts: webhook.retryMaxAttempts,
      backoff: {
        type: 'exponential',
        delay: Math.round(webhook.retryBackoffBase * 1000),
      },
    });

    this.logger.log(
      { eventId, webhookId, eventType: payload.type, instanceId: payload.instance_id },
      'Webhook dispatched to queue',
    );
  }

  async dispatchToInstance(
    instanceId: string,
    payload: WebhookPayload,
  ): Promise<void> {
    const webhooks = await this.prisma.webhook.findMany({
      where: { instanceId, enabled: true },
    });

    this.logger.debug(
      { instanceId, webhookCount: webhooks.length, eventType: payload.type },
      'Dispatching to instance webhooks',
    );

    await Promise.all(
      webhooks.map((webhook) => this.dispatch(webhook.id, payload)),
    );
  }

  async dispatchEvent(
    instanceId: string,
    tenantId: string,
    eventType: WebhookEvent,
    data: Record<string, any>,
  ): Promise<void> {
    const payload = this.buildPayload(eventType, instanceId, tenantId, data);
    await this.dispatchToInstance(instanceId, payload);
  }
}

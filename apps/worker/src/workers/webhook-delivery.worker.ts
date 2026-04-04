import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Worker, Job } from 'bullmq';

interface WebhookDeliveryJob {
  id: string;
  url: string;
  payload: string;
  signature: string;
  instanceId: string;
  messageId: string;
  attempt: number;
}

@Injectable()
export class WebhookDeliveryWorker implements OnModuleInit {
  private readonly logger = new Logger(WebhookDeliveryWorker.name);
  private worker!: Worker;

  onModuleInit(): void {
    this.worker = new Worker(
      'webhook-delivery',
      async (job: Job<WebhookDeliveryJob>) => {
        await this.processJob(job);
      },
      {
        connection: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB ?? '0', 10),
        },
        concurrency: parseInt(
          process.env.WEBHOOK_CONCURRENCY ?? '20',
          10,
        ),
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error('Webhook delivery failed', {
        jobId: job?.id,
        webhookId: job?.data?.id,
        url: job?.data?.url,
        error: error.message,
      });
    });

    this.logger.log('Webhook delivery worker started');
  }

  private async processJob(
    job: Job<WebhookDeliveryJob>,
  ): Promise<void> {
    const { id, url, payload, signature, instanceId, messageId } =
      job.data;

    this.logger.debug('Delivering webhook', {
      webhookId: id,
      url,
      instanceId,
      messageId,
      attempt: job.attemptsMade + 1,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Nexconnect-Signature': signature,
          'X-Nexconnect-Event': 'message.received',
          'X-Nexconnect-Delivery': id,
          'User-Agent': 'NexConnect-Webhook/1.0',
        },
        body: payload,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Webhook returned HTTP ${response.status}: ${response.statusText}`,
        );
      }

      this.logger.log('Webhook delivered', {
        webhookId: id,
        url,
        statusCode: response.status,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

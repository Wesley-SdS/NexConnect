import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Worker, Job } from 'bullmq';
import { PrismaService } from '@nexconnect/database';

interface ScheduledMessageJob {
  batchId: string;
  triggeredAt: number;
}

@Injectable()
export class ScheduledMessageWorker implements OnModuleInit {
  private readonly logger = new Logger(ScheduledMessageWorker.name);
  private worker!: Worker;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('outbound-messages')
    private readonly outboundQueue: Queue,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(
      'scheduled-messages',
      async (job: Job<ScheduledMessageJob>) => {
        await this.processJob(job);
      },
      {
        connection: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB ?? '0', 10),
        },
        concurrency: 1,
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error('Scheduled message job failed', {
        jobId: job?.id,
        batchId: job?.data?.batchId,
        error: error.message,
      });
    });

    this.logger.log('Scheduled message worker started');
  }

  private async processJob(
    job: Job<ScheduledMessageJob>,
  ): Promise<void> {
    this.logger.debug('Processing scheduled messages batch', {
      batchId: job.data.batchId,
    });

    const now = new Date();

    const pendingMessages = await this.prisma.$queryRaw<
      Array<{
        id: string;
        instance_id: string;
        jid: string;
        content: string;
        scheduled_at: Date;
      }>
    >`
      SELECT id, instance_id, jid, content, scheduled_at
      FROM scheduled_messages
      WHERE scheduled_at <= ${now}
        AND status = 'pending'
      ORDER BY scheduled_at ASC
      LIMIT 100
    `;

    if (pendingMessages.length === 0) {
      this.logger.debug('No pending scheduled messages');
      return;
    }

    this.logger.log('Enqueuing scheduled messages', {
      count: pendingMessages.length,
    });

    for (const message of pendingMessages) {
      let parsedContent: any;
      try {
        parsedContent =
          typeof message.content === 'string'
            ? JSON.parse(message.content)
            : message.content;
      } catch {
        this.logger.error('Invalid message content format', {
          messageId: message.id,
        });
        continue;
      }

      await this.outboundQueue.add(
        'send-message',
        {
          id: message.id,
          instanceId: message.instance_id,
          jid: message.jid,
          content: parsedContent,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );

      await this.prisma.$executeRaw`
        UPDATE scheduled_messages
        SET status = 'enqueued', updated_at = NOW()
        WHERE id = ${message.id}
      `;
    }
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { proto } from '@whiskeysockets/baileys';
import { BaileysConnectionService } from '../connection/baileys-connection.service';

interface OutboundMessageJob {
  id: string;
  instanceId: string;
  jid: string;
  content: proto.IMessage;
  scheduledAt?: number;
}

@Injectable()
export class OutboundMessageWorker implements OnModuleInit {
  private readonly logger = new Logger(OutboundMessageWorker.name);
  private worker!: Worker;

  constructor(
    private readonly baileysConnection: BaileysConnectionService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(
      'outbound-messages',
      async (job: Job<OutboundMessageJob>) => {
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
          process.env.OUTBOUND_CONCURRENCY ?? '10',
          10,
        ),
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error('Outbound message job failed', {
        jobId: job?.id,
        messageId: job?.data?.id,
        error: error.message,
      });
    });

    this.logger.log('Outbound message worker started');
  }

  private async processJob(
    job: Job<OutboundMessageJob>,
  ): Promise<void> {
    const { id, instanceId, jid, content } = job.data;

    this.logger.debug('Sending outbound message', {
      jobId: job.id,
      messageId: id,
      instanceId,
      jid,
    });

    this.validateJob(job.data);

    if (!this.baileysConnection.isConnected(instanceId)) {
      throw new Error(
        `Instance ${instanceId} is not connected. Cannot send message.`,
      );
    }

    const result = await this.baileysConnection.sendMessage(
      instanceId,
      jid,
      content,
    );

    this.logger.log('Outbound message sent', {
      messageId: id,
      instanceId,
      jid,
      baileysMessageId: result?.key?.id,
    });
  }

  private validateJob(data: OutboundMessageJob): void {
    if (!data.instanceId) {
      throw new Error('Missing instanceId in outbound message job');
    }
    if (!data.jid) {
      throw new Error('Missing jid in outbound message job');
    }
    if (!data.content) {
      throw new Error('Missing content in outbound message job');
    }
  }
}

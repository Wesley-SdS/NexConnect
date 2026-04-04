import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { MessagePipelineService } from '../pipeline/message-pipeline.service';
import { MessageContext } from '@nexconnect/core';

interface InboundMessageJob {
  id: string;
  instanceId: string;
  rawMessage: any;
  receivedAt: number;
}

@Injectable()
export class MessageProcessorWorker implements OnModuleInit {
  private readonly logger = new Logger(MessageProcessorWorker.name);
  private worker!: Worker;

  constructor(
    private readonly pipeline: MessagePipelineService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(
      'inbound-messages',
      async (job: Job<InboundMessageJob>) => {
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
          process.env.INBOUND_CONCURRENCY ?? '5',
          10,
        ),
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error('Inbound message job failed', {
        jobId: job?.id,
        messageId: job?.data?.id,
        error: error.message,
      });
    });

    this.logger.log('Message processor worker started');
  }

  private async processJob(
    job: Job<InboundMessageJob>,
  ): Promise<void> {
    const { id, instanceId, rawMessage, receivedAt } = job.data;

    const queueLatencyMs = Date.now() - receivedAt;

    this.logger.debug('Processing inbound message', {
      jobId: job.id,
      messageId: id,
      instanceId,
      queueLatencyMs,
    });

    const context: MessageContext = {
      id,
      instanceId,
      rawMessage,
      receivedAt,
    };

    await this.pipeline.process(context);
  }
}

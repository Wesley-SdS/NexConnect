import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);
  readonly registry: Registry;

  readonly messagesReceived: Counter;
  readonly messagesSent: Counter;
  readonly messagesFailed: Counter;
  readonly webhookDeliveryDuration: Histogram;
  readonly mediaProcessingDuration: Histogram;
  readonly sttTranscriptionDuration: Histogram;
  readonly numberHealthScore: Gauge;
  readonly connectionUptime: Gauge;
  readonly activeInstances: Gauge;
  readonly bufferFlush: Counter;
  readonly pipelineStageDuration: Histogram;
  readonly httpRequestsTotal: Counter;
  readonly httpRequestDuration: Histogram;

  constructor() {
    this.registry = new Registry();

    this.messagesReceived = new Counter({
      name: 'nexconnect_messages_received_total',
      help: 'Total number of messages received',
      labelNames: ['instance_id', 'type'] as const,
      registers: [this.registry],
    });

    this.messagesSent = new Counter({
      name: 'nexconnect_messages_sent_total',
      help: 'Total number of messages sent',
      labelNames: ['instance_id', 'type', 'status'] as const,
      registers: [this.registry],
    });

    this.messagesFailed = new Counter({
      name: 'nexconnect_messages_failed_total',
      help: 'Total number of failed messages',
      labelNames: ['instance_id', 'error_code'] as const,
      registers: [this.registry],
    });

    this.webhookDeliveryDuration = new Histogram({
      name: 'nexconnect_webhook_delivery_duration_ms',
      help: 'Webhook delivery duration in milliseconds',
      labelNames: ['webhook_id'] as const,
      buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
      registers: [this.registry],
    });

    this.mediaProcessingDuration = new Histogram({
      name: 'nexconnect_media_processing_duration_ms',
      help: 'Media processing duration in milliseconds',
      labelNames: ['type'] as const,
      buckets: [100, 500, 1000, 2500, 5000, 10000, 30000],
      registers: [this.registry],
    });

    this.sttTranscriptionDuration = new Histogram({
      name: 'nexconnect_stt_transcription_duration_ms',
      help: 'Speech-to-text transcription duration in milliseconds',
      labelNames: ['provider'] as const,
      buckets: [500, 1000, 2500, 5000, 10000, 30000, 60000],
      registers: [this.registry],
    });

    this.numberHealthScore = new Gauge({
      name: 'nexconnect_number_health_score',
      help: 'Health score of a WhatsApp number instance',
      labelNames: ['instance_id'] as const,
      registers: [this.registry],
    });

    this.connectionUptime = new Gauge({
      name: 'nexconnect_connection_uptime_seconds',
      help: 'Connection uptime in seconds',
      labelNames: ['instance_id'] as const,
      registers: [this.registry],
    });

    this.activeInstances = new Gauge({
      name: 'nexconnect_active_instances',
      help: 'Number of currently active instances',
      registers: [this.registry],
    });

    this.bufferFlush = new Counter({
      name: 'nexconnect_buffer_flush_total',
      help: 'Total number of buffer flushes',
      labelNames: ['instance_id', 'reason'] as const,
      registers: [this.registry],
    });

    this.pipelineStageDuration = new Histogram({
      name: 'nexconnect_pipeline_stage_duration_ms',
      help: 'Pipeline stage processing duration in milliseconds',
      labelNames: ['stage'] as const,
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
      registers: [this.registry],
    });

    this.httpRequestsTotal = new Counter({
      name: 'nexconnect_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'] as const,
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'nexconnect_http_request_duration_ms',
      help: 'HTTP request duration in milliseconds',
      labelNames: ['method', 'path'] as const,
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
      registers: [this.registry],
    });
  }

  onModuleInit(): void {
    collectDefaultMetrics({ register: this.registry });
    this.logger.log('Prometheus metrics initialized');
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}

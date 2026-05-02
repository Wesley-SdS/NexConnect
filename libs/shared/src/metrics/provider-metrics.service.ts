import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';

/**
 * Centralized Prometheus instrumentation for messaging providers.
 * Counters and histograms are registered against the default global
 * registry so they show up alongside existing Nest metrics.
 *
 * Naming convention follows the Prometheus best-practice of
 * `nexconnect_provider_<noun>_<unit>` where the unit is suffixed
 * (`_total`, `_seconds`, `_bytes`).
 */
@Injectable()
export class ProviderMetricsService {
  readonly sendTotal: Counter<string>;
  readonly sendDuration: Histogram<string>;
  readonly webhookReceivedTotal: Counter<string>;
  readonly webhookSignatureFailures: Counter<string>;
  readonly mediaIngestionTotal: Counter<string>;
  readonly credentialStatusGauge: Counter<string>;

  constructor(private readonly registry?: Registry) {
    const opts = this.registry ? { registers: [this.registry] } : {};

    this.sendTotal = new Counter({
      name: 'nexconnect_provider_send_total',
      help: 'Outbound messages dispatched per provider',
      labelNames: ['provider', 'status', 'tenant'],
      ...opts,
    });

    this.sendDuration = new Histogram({
      name: 'nexconnect_provider_send_duration_ms',
      help: 'Outbound provider request duration (milliseconds)',
      labelNames: ['provider', 'status'],
      buckets: [50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000],
      ...opts,
    });

    this.webhookReceivedTotal = new Counter({
      name: 'nexconnect_webhook_received_total',
      help: 'Inbound provider webhook events received',
      labelNames: ['provider', 'event_type', 'outcome'],
      ...opts,
    });

    this.webhookSignatureFailures = new Counter({
      name: 'nexconnect_webhook_signature_failures_total',
      help: 'Webhook signature validation failures',
      labelNames: ['provider', 'reason'],
      ...opts,
    });

    this.mediaIngestionTotal = new Counter({
      name: 'nexconnect_provider_media_ingestion_total',
      help: 'Inbound media files downloaded and persisted to R2',
      labelNames: ['provider', 'mime_type', 'outcome'],
      ...opts,
    });

    this.credentialStatusGauge = new Counter({
      name: 'nexconnect_provider_credentials_total',
      help: 'Provider credential status snapshot',
      labelNames: ['provider', 'status'],
      ...opts,
    });
  }

  recordSend(provider: string, status: 'ok' | 'failed', durationMs: number, tenant: string): void {
    this.sendTotal.labels(provider, status, tenant).inc();
    this.sendDuration.labels(provider, status).observe(durationMs);
  }

  recordWebhook(provider: string, eventType: string, outcome: 'processed' | 'discarded' | 'failed'): void {
    this.webhookReceivedTotal.labels(provider, eventType, outcome).inc();
  }

  recordSignatureFailure(provider: string, reason: string): void {
    this.webhookSignatureFailures.labels(provider, reason).inc();
  }

  recordMediaIngestion(provider: string, mimeType: string, outcome: 'ok' | 'failed'): void {
    this.mediaIngestionTotal.labels(provider, mimeType, outcome).inc();
  }
}

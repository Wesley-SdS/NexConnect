import { Injectable, Logger } from '@nestjs/common';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import {
  trace,
  Span,
  SpanStatusCode,
  SpanKind,
  Tracer,
  context,
  Attributes,
} from '@opentelemetry/api';

export interface PipelineSpanAttributes {
  instanceId: string;
  messageType: string;
  tenantId: string;
}

/**
 * Attributes attached to BullMQ job spans.
 */
export interface JobSpanAttributes {
  'job.name': string;
  'job.queue'?: string;
  'job.id'?: string;
  [key: string]: unknown;
}

/**
 * Attributes attached to database operation spans.
 */
export interface DatabaseSpanAttributes {
  'db.operation': string;
  'db.model': string;
  'db.system': string;
  [key: string]: unknown;
}

@Injectable()
export class TracingService {
  private readonly logger = new Logger(TracingService.name);
  private sdk: NodeSDK | null = null;
  private readonly serviceName: string;

  constructor() {
    this.serviceName = process.env.OTEL_SERVICE_NAME ?? 'nexconnect';
  }

  async initialize(): Promise<void> {
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

    if (!endpoint) {
      this.logger.warn(
        'OTEL_EXPORTER_OTLP_ENDPOINT not set — tracing disabled',
      );
      return;
    }

    const exporter = new OTLPTraceExporter({ url: `${endpoint}/v1/traces` });

    this.sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: this.serviceName,
        [ATTR_SERVICE_VERSION]: process.env.APP_VERSION ?? '1.0.0',
      }),
      spanProcessor: new BatchSpanProcessor(exporter, {
        maxQueueSize: 2048,
        maxExportBatchSize: 512,
        scheduledDelayMillis: 5000,
        exportTimeoutMillis: 30000,
      }),
    });

    this.sdk.start();
    this.logger.log(`OpenTelemetry tracing initialized → ${endpoint}`);
  }

  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
      this.logger.log('OpenTelemetry SDK shut down');
    }
  }

  getTracer(name?: string): Tracer {
    return trace.getTracer(name ?? this.serviceName);
  }

  startPipelineSpan(
    stage: string,
    attributes: PipelineSpanAttributes,
  ): Span {
    const tracer = this.getTracer();

    return tracer.startSpan(`pipeline.${stage}`, {
      attributes: {
        'pipeline.stage': stage,
        'pipeline.instance_id': attributes.instanceId,
        'pipeline.message_type': attributes.messageType,
        'pipeline.tenant_id': attributes.tenantId,
      },
    });
  }

  endSpanSuccess(span: Span, attributes?: Attributes): void {
    if (attributes) {
      span.setAttributes(attributes);
    }
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  }

  endSpanError(span: Span, error: Error, attributes?: Attributes): void {
    if (attributes) {
      span.setAttributes(attributes);
    }
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    span.recordException(error);
    span.end();
  }

  runInSpan<T>(
    spanName: string,
    attributes: Attributes,
    fn: (span: Span) => Promise<T>,
  ): Promise<T> {
    const tracer = this.getTracer();

    return tracer.startActiveSpan(spanName, { attributes }, async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  getActiveSpan(): Span | undefined {
    return trace.getSpan(context.active());
  }

  /**
   * Create a span for a BullMQ job. The returned span should be ended by the
   * caller after the job finishes processing (use `endSpanSuccess` / `endSpanError`).
   *
   * Trace context (traceId, spanId) is injected into `data` so it can be
   * propagated to the job consumer.
   *
   * @param jobName - The name of the BullMQ job (e.g. 'send-message', 'process-webhook')
   * @param data - Mutable job data object; trace context keys will be added
   */
  createJobSpan(
    jobName: string,
    data: Record<string, unknown>,
  ): Span {
    const tracer = this.getTracer();

    const span = tracer.startSpan(`job.${jobName}`, {
      kind: SpanKind.PRODUCER,
      attributes: {
        'job.name': jobName,
        'job.system': 'bullmq',
      },
    });

    // Propagate trace context into the job data so the consumer can link spans
    const spanContext = span.spanContext();
    data['_traceId'] = spanContext.traceId;
    data['_spanId'] = spanContext.spanId;
    data['_traceFlags'] = spanContext.traceFlags;

    return span;
  }

  /**
   * Create a span for a database operation. Useful as Prisma middleware to
   * trace individual queries.
   *
   * @param operation - The database operation (e.g. 'findMany', 'create', 'update', 'delete')
   * @param model - The Prisma model name (e.g. 'Instance', 'Message', 'Tenant')
   */
  createDatabaseSpan(operation: string, model: string): Span {
    const tracer = this.getTracer();

    return tracer.startSpan(`db.${model}.${operation}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'db.operation': operation,
        'db.model': model,
        'db.system': 'prisma',
      },
    });
  }

  /**
   * Returns a Prisma middleware function that automatically traces all queries.
   *
   * @example
   * ```ts
   * const prisma = new PrismaClient();
   * prisma.$use(tracingService.createPrismaMiddleware());
   * ```
   */
  createPrismaMiddleware() {
    return async (
      params: { model?: string; action: string; args: any },
      next: (params: any) => Promise<any>,
    ) => {
      const model = params.model ?? 'unknown';
      const span = this.createDatabaseSpan(params.action, model);

      try {
        const result = await next(params);
        this.endSpanSuccess(span, {
          'db.statement': params.action,
        });
        return result;
      } catch (error) {
        this.endSpanError(span, error as Error);
        throw error;
      }
    };
  }
}

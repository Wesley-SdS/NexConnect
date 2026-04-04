import { Injectable, Logger } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * Context stored in AsyncLocalStorage for automatic propagation.
 */
export interface RequestContext {
  correlationId: string;
  tenantId?: string;
  instanceId?: string;
  [key: string]: unknown;
}

/**
 * Structured log entry emitted by RequestLogger.
 */
export interface StructuredLogEntry {
  event: string;
  correlationId?: string;
  service: string;
  timestamp: string;
  [key: string]: unknown;
}

/**
 * Injectable service that provides structured logging with automatic context
 * propagation from AsyncLocalStorage.
 *
 * Context is automatically attached to every log entry when running inside
 * a request scope initialized via `runWithContext`.
 *
 * @example
 * ```ts
 * // In a middleware or interceptor:
 * requestLogger.runWithContext({ correlationId: req.id, tenantId }, async () => {
 *   await someService.doWork();
 * });
 *
 * // In a service:
 * this.requestLogger.info('message.processed', { messageId, recipientCount: 5 });
 * ```
 */
@Injectable()
export class RequestLogger {
  private readonly logger = new Logger(RequestLogger.name);
  private static readonly storage = new AsyncLocalStorage<RequestContext>();
  private readonly serviceName: string;

  constructor() {
    this.serviceName = process.env.OTEL_SERVICE_NAME ?? 'nexconnect';
  }

  /**
   * Execute a function within a request context. All log calls inside the
   * callback will automatically include the provided context.
   */
  runWithContext<T>(context: RequestContext, fn: () => T): T {
    return RequestLogger.storage.run(context, fn);
  }

  /**
   * Get the current request context, if any.
   */
  getContext(): RequestContext | undefined {
    return RequestLogger.storage.getStore();
  }

  /**
   * Log an informational event.
   */
  info(event: string, data?: Record<string, unknown>): void {
    this.logger.log(this.buildEntry(event, data));
  }

  /**
   * Log a warning event.
   */
  warn(event: string, data?: Record<string, unknown>): void {
    this.logger.warn(this.buildEntry(event, data));
  }

  /**
   * Log an error event with error details.
   */
  error(event: string, error: Error, data?: Record<string, unknown>): void {
    this.logger.error(
      this.buildEntry(event, {
        ...data,
        error: error.message,
        errorName: error.name,
        stackTrace: error.stack,
      }),
    );
  }

  /**
   * Log a debug event.
   */
  debug(event: string, data?: Record<string, unknown>): void {
    this.logger.debug(this.buildEntry(event, data));
  }

  private buildEntry(
    event: string,
    data?: Record<string, unknown>,
  ): StructuredLogEntry {
    const context = RequestLogger.storage.getStore();

    return {
      event,
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      ...(context?.correlationId && { correlationId: context.correlationId }),
      ...(context?.tenantId && { tenantId: context.tenantId }),
      ...(context?.instanceId && { instanceId: context.instanceId }),
      ...data,
    };
  }
}

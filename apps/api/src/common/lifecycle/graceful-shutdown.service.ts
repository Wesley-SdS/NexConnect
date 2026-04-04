import {
  Injectable,
  Logger,
  OnModuleDestroy,
  BeforeApplicationShutdown,
} from '@nestjs/common';

const SHUTDOWN_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 500;

/**
 * Tracks in-flight HTTP requests and ensures a graceful shutdown:
 * 1. Stops accepting new requests (tracked via increment/decrement)
 * 2. Waits for all in-flight requests to complete
 * 3. Times out after 30 seconds if requests are still pending
 *
 * Register as a global provider and call `trackRequest()` / `requestComplete()`
 * from middleware or interceptor, or rely on the NestJS lifecycle hooks.
 */
@Injectable()
export class GracefulShutdownService
  implements OnModuleDestroy, BeforeApplicationShutdown
{
  private readonly logger = new Logger(GracefulShutdownService.name);
  private activeRequests = 0;
  private isShuttingDown = false;

  /** Returns true if the application is in the process of shutting down. */
  get shuttingDown(): boolean {
    return this.isShuttingDown;
  }

  /** Returns the current number of in-flight requests. */
  get inflightCount(): number {
    return this.activeRequests;
  }

  /** Call when a new request starts being processed. */
  trackRequest(): void {
    if (this.isShuttingDown) {
      this.logger.warn('New request received during shutdown — will be processed but no new ones should be accepted');
    }
    this.activeRequests++;
  }

  /** Call when a request finishes (success or error). */
  requestComplete(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  /**
   * Called before the application starts shutting down modules.
   * Waits for in-flight requests to drain.
   */
  async beforeApplicationShutdown(signal?: string): Promise<void> {
    this.isShuttingDown = true;
    this.logger.log(
      `Shutdown signal received: ${signal ?? 'unknown'}. Active requests: ${this.activeRequests}`,
    );

    if (this.activeRequests === 0) {
      this.logger.log('No active requests — proceeding with shutdown');
      return;
    }

    this.logger.log(
      `Waiting for ${this.activeRequests} in-flight request(s) to complete (timeout: ${SHUTDOWN_TIMEOUT_MS}ms)...`,
    );

    await this.waitForDrain();
  }

  /**
   * Called when the module is being destroyed.
   * Final cleanup logging.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.activeRequests > 0) {
      this.logger.warn(
        `Module destroying with ${this.activeRequests} request(s) still in-flight`,
      );
    } else {
      this.logger.log('All requests drained — module destroying cleanly');
    }
  }

  private waitForDrain(): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const check = (): void => {
        const elapsed = Date.now() - startTime;

        if (this.activeRequests === 0) {
          this.logger.log(
            `All requests drained after ${elapsed}ms — proceeding with shutdown`,
          );
          resolve();
          return;
        }

        if (elapsed >= SHUTDOWN_TIMEOUT_MS) {
          this.logger.error(
            `Shutdown timeout reached (${SHUTDOWN_TIMEOUT_MS}ms) with ${this.activeRequests} request(s) still pending — forcing shutdown`,
          );
          resolve();
          return;
        }

        this.logger.debug(
          `Waiting for ${this.activeRequests} request(s) to complete (${elapsed}ms elapsed)`,
        );

        setTimeout(check, POLL_INTERVAL_MS);
      };

      check();
    });
  }
}

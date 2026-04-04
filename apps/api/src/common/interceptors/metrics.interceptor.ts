import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { FastifyReply, FastifyRequest } from 'fastify';
import { MetricsService } from '../../modules/metrics/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const { method, url } = request;
    const path = this.normalizePath(url);
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<FastifyReply>();
          const duration = Date.now() - startTime;
          const status = String(response.statusCode);

          this.metricsService.httpRequestsTotal
            .labels(method, path, status)
            .inc();

          this.metricsService.httpRequestDuration
            .labels(method, path)
            .observe(duration);
        },
        error: () => {
          const duration = Date.now() - startTime;

          this.metricsService.httpRequestsTotal
            .labels(method, path, '500')
            .inc();

          this.metricsService.httpRequestDuration
            .labels(method, path)
            .observe(duration);
        },
      }),
    );
  }

  /**
   * Normalizes URL paths by replacing UUIDs and ULIDs with :id placeholders,
   * preventing high-cardinality label explosion in Prometheus.
   */
  private normalizePath(url: string): string {
    const pathOnly = url.split('?')[0];

    return pathOnly
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        ':id',
      )
      .replace(/[0-9A-HJKMNP-TV-Z]{26}/g, ':id');
  }
}

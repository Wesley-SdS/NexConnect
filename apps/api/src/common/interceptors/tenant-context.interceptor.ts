import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { FastifyRequest } from 'fastify';
import { PrismaService } from '@nexconnect/database';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantContextInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const tenant = (request as FastifyRequest & { tenant?: { id: string } }).tenant;

    if (!tenant?.id) {
      return next.handle();
    }

    const tenantId = tenant.id as string;

    return new Observable((subscriber) => {
      this.prisma
        .setTenantContext(tenantId)
        .then(() => {
          next
            .handle()
            .pipe(
              tap({
                complete: () => {
                  this.prisma.clearTenantContext().catch((err) => {
                    this.logger.error(
                      { tenantId, error: err.message },
                      'tenant-context.clear.failed',
                    );
                  });
                },
                error: () => {
                  this.prisma.clearTenantContext().catch((err) => {
                    this.logger.error(
                      { tenantId, error: err.message },
                      'tenant-context.clear.failed',
                    );
                  });
                },
              }),
            )
            .subscribe(subscriber);
        })
        .catch((err) => {
          this.logger.error(
            { tenantId, error: err.message },
            'tenant-context.set.failed',
          );
          subscriber.error(err);
        });
    });
  }
}

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PiiRedactor } from '@nexconnect/shared';

/**
 * Interceptor that applies PII redaction to response data in logs only.
 * The actual response sent to the client is NOT modified.
 */
@Injectable()
export class PiiRedactionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PiiRedactionInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap((responseData) => {
        if (responseData !== undefined && responseData !== null) {
          const redacted = PiiRedactor.redact(responseData);

          this.logger.debug({
            msg: 'Response data (PII redacted)',
            handler: context.getHandler().name,
            controller: context.getClass().name,
            data: redacted,
          });
        }
      }),
    );
  }
}

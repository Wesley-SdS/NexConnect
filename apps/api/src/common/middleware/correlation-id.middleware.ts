import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { AsyncLocalStorage } from 'async_hooks';
import { UlidUtil } from '@nexconnect/shared';

export const correlationStorage = new AsyncLocalStorage<string>();

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(
    request: FastifyRequest['raw'],
    response: FastifyReply['raw'],
    next: () => void,
  ): void {
    const existingId =
      (request.headers['x-correlation-id'] as string) ?? undefined;
    const correlationId = existingId || UlidUtil.generate();

    (request as typeof request & { correlationId: string }).correlationId = correlationId;
    response.setHeader('x-correlation-id', correlationId);

    correlationStorage.run(correlationId, () => {
      next();
    });
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { MetaSignatureValidator } from '@nexconnect/shared';

/**
 * Validates the X-Hub-Signature-256 header that Meta attaches to every
 * webhook event. Requires the raw request body preserved on
 * `request.rawBody` (registered by the Meta webhook controller via a
 * Fastify preParsing hook).
 */
@Injectable()
export class MetaSignatureGuard implements CanActivate {
  private readonly logger = new Logger(MetaSignatureGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest & { rawBody?: Buffer }>();
    const signature = (request.headers['x-hub-signature-256'] ?? '') as string;
    const appSecret = process.env.META_APP_SECRET;

    if (!appSecret) {
      this.logger.error('META_APP_SECRET missing — refusing to accept webhook');
      throw new UnauthorizedException('Meta webhook secret is not configured');
    }

    const rawBody = request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {}), 'utf8');

    const result = MetaSignatureValidator.validate({
      rawBody,
      signatureHeader: signature,
      appSecret,
    });

    if (!result.valid) {
      this.logger.warn(
        {
          reason: result.reason,
          signaturePresent: Boolean(signature),
          ip: request.ip,
          path: request.url,
        },
        'meta.webhook.signature.invalid',
      );
      throw new UnauthorizedException(`Invalid webhook signature: ${result.reason}`);
    }
    return true;
  }
}

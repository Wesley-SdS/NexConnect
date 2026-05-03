import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { ProviderType } from '@nexconnect/core';
import { ProviderMetricsService } from '@nexconnect/shared';
import {
  CREDENTIAL_RESOLVER,
  CredentialResolver,
} from '../../providers/credential.resolver';

/**
 * Telegram authenticates webhook deliveries via the
 * X-Telegram-Bot-Api-Secret-Token header — a bot-controlled
 * shared secret echoed verbatim by Telegram. We resolve the
 * tenant via the URL `:credentialId` route param and compare
 * against the credential's `webhookSecretToken`.
 */
@Injectable()
export class TelegramSecretTokenGuard implements CanActivate {
  private readonly logger = new Logger(TelegramSecretTokenGuard.name);

  constructor(
    private readonly metrics: ProviderMetricsService,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      FastifyRequest & { params: { credentialId?: string }; telegramCredentialId?: string }
    >();

    const credentialId = request.params?.credentialId;
    if (!credentialId) {
      this.metrics.recordSignatureFailure(ProviderType.TELEGRAM, 'MISSING_CREDENTIAL_ID');
      throw new UnauthorizedException('Missing credentialId path parameter');
    }

    const data = await this.credentials.resolve(credentialId).catch(() => null);
    if (!data || data.type !== ProviderType.TELEGRAM) {
      this.metrics.recordSignatureFailure(ProviderType.TELEGRAM, 'UNKNOWN_CREDENTIAL');
      throw new UnauthorizedException('Unknown Telegram credential');
    }

    const headerToken = request.headers['x-telegram-bot-api-secret-token'];
    if (!headerToken || headerToken !== data.webhookSecretToken) {
      this.metrics.recordSignatureFailure(ProviderType.TELEGRAM, 'INVALID_SECRET');
      this.logger.warn(
        { credentialId, ip: request.ip, headerPresent: Boolean(headerToken) },
        'telegram.webhook.signature.invalid',
      );
      throw new UnauthorizedException('Invalid Telegram secret token');
    }

    request.telegramCredentialId = credentialId;
    return true;
  }
}

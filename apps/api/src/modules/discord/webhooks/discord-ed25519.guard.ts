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
import {
  Ed25519SignatureValidator,
  ProviderMetricsService,
} from '@nexconnect/shared';
import {
  CREDENTIAL_RESOLVER,
  CredentialResolver,
} from '../../providers/credential.resolver';

@Injectable()
export class DiscordEd25519Guard implements CanActivate {
  private readonly logger = new Logger(DiscordEd25519Guard.name);

  constructor(
    private readonly metrics: ProviderMetricsService,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      FastifyRequest & {
        params: { credentialId?: string };
        rawBody?: Buffer;
        discordCredentialId?: string;
      }
    >();

    const credentialId = request.params?.credentialId;
    if (!credentialId) {
      this.metrics.recordSignatureFailure(ProviderType.DISCORD, 'MISSING_CREDENTIAL_ID');
      throw new UnauthorizedException('Missing credentialId path parameter');
    }

    const data = await this.credentials.resolve(credentialId).catch(() => null);
    if (!data || data.type !== ProviderType.DISCORD) {
      this.metrics.recordSignatureFailure(ProviderType.DISCORD, 'UNKNOWN_CREDENTIAL');
      throw new UnauthorizedException('Unknown Discord credential');
    }

    const signatureHex = (request.headers['x-signature-ed25519'] ?? '') as string;
    const timestamp = (request.headers['x-signature-timestamp'] ?? '') as string;
    const rawBody = request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {}), 'utf8');

    const result = Ed25519SignatureValidator.validate({
      signatureHex,
      timestamp,
      publicKeyHex: data.publicKey,
      rawBody,
    });

    if (!result.valid) {
      this.metrics.recordSignatureFailure(ProviderType.DISCORD, result.reason ?? 'unknown');
      this.logger.warn(
        { credentialId, reason: result.reason, ip: request.ip },
        'discord.webhook.signature.invalid',
      );
      throw new UnauthorizedException(`Invalid Discord signature: ${result.reason}`);
    }

    request.discordCredentialId = credentialId;
    return true;
  }
}

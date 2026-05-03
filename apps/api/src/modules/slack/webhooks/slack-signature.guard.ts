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
  ProviderMetricsService,
  SlackSignatureValidator,
} from '@nexconnect/shared';
import {
  CREDENTIAL_RESOLVER,
  CredentialResolver,
} from '../../providers/credential.resolver';

@Injectable()
export class SlackSignatureGuard implements CanActivate {
  private readonly logger = new Logger(SlackSignatureGuard.name);

  constructor(
    private readonly metrics: ProviderMetricsService,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      FastifyRequest & {
        params: { credentialId?: string };
        rawBody?: Buffer;
        slackCredentialId?: string;
      }
    >();

    const credentialId = request.params?.credentialId;
    if (!credentialId) {
      this.metrics.recordSignatureFailure(ProviderType.SLACK, 'MISSING_CREDENTIAL_ID');
      throw new UnauthorizedException('Missing credentialId path parameter');
    }
    const data = await this.credentials.resolve(credentialId).catch(() => null);
    if (!data || data.type !== ProviderType.SLACK) {
      this.metrics.recordSignatureFailure(ProviderType.SLACK, 'UNKNOWN_CREDENTIAL');
      throw new UnauthorizedException('Unknown Slack credential');
    }

    const signature = (request.headers['x-slack-signature'] ?? '') as string;
    const timestamp = (request.headers['x-slack-request-timestamp'] ?? '') as string;
    const rawBody = request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {}), 'utf8');

    const result = SlackSignatureValidator.validate({
      signatureHeader: signature,
      timestampHeader: timestamp,
      signingSecret: data.signingSecret,
      rawBody,
    });

    if (!result.valid) {
      this.metrics.recordSignatureFailure(ProviderType.SLACK, result.reason ?? 'unknown');
      this.logger.warn(
        { credentialId, reason: result.reason, ip: request.ip },
        'slack.webhook.signature.invalid',
      );
      throw new UnauthorizedException(`Invalid Slack signature: ${result.reason}`);
    }

    request.slackCredentialId = credentialId;
    return true;
  }
}

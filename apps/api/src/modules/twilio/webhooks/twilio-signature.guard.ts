import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Inject } from '@nestjs/common';
import { TwilioSignatureValidator } from '@nexconnect/shared';
import {
  CREDENTIAL_RESOLVER,
  CredentialResolver,
} from '../../providers/credential.resolver';

/**
 * Validates the X-Twilio-Signature header. Resolves the AccountSid
 * from the body, looks up the tenant's auth token, and applies either
 * form-encoded or JSON validation depending on content-type.
 */
@Injectable()
export class TwilioSignatureGuard implements CanActivate {
  private readonly logger = new Logger(TwilioSignatureGuard.name);

  constructor(@Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if ((process.env.TWILIO_VALIDATE_SIGNATURE ?? 'true').toLowerCase() !== 'true') {
      return true;
    }

    const request = context.switchToHttp().getRequest<
      FastifyRequest & { rawBody?: Buffer }
    >();
    const signatureHeader = (request.headers['x-twilio-signature'] ?? '') as string;
    if (!signatureHeader) {
      throw new UnauthorizedException('Missing X-Twilio-Signature header');
    }

    const body = (request.body ?? {}) as Record<string, string>;
    const accountSid = body.AccountSid ?? body.accountSid;
    if (!accountSid) {
      throw new UnauthorizedException('Cannot resolve tenant: AccountSid missing from body');
    }

    const owner = await this.credentials.findByAccountSid(accountSid);
    if (!owner) {
      throw new UnauthorizedException(`No credentials for AccountSid ${accountSid}`);
    }
    const creds = await this.credentials.resolveTwilio(owner.credentialId);

    const url = this.resolveUrl(request);
    const contentType = (request.headers['content-type'] ?? '') as string;
    const result = contentType.includes('application/json')
      ? TwilioSignatureValidator.validateJson({
          authToken: creds.authToken,
          signatureHeader,
          url,
          rawBody: request.rawBody ?? Buffer.from(JSON.stringify(body), 'utf8'),
        })
      : TwilioSignatureValidator.validateForm({
          authToken: creds.authToken,
          signatureHeader,
          url,
          params: this.onlyStringParams(body),
        });

    if (!result.valid) {
      this.logger.warn(
        { reason: result.reason, accountSid, contentType, url },
        'twilio.webhook.signature.invalid',
      );
      throw new UnauthorizedException(`Invalid Twilio signature: ${result.reason}`);
    }

    (request as { twilioCredentialId?: string }).twilioCredentialId = owner.credentialId;
    (request as { twilioOwner?: typeof owner }).twilioOwner = owner;
    return true;
  }

  private onlyStringParams(obj: Record<string, unknown>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') out[k] = v;
      else if (v !== undefined && v !== null) out[k] = String(v);
    }
    return out;
  }

  private resolveUrl(request: FastifyRequest): string {
    const forwardedProto = (request.headers['x-forwarded-proto'] ?? '').toString().split(',')[0].trim();
    const forwardedHost = (request.headers['x-forwarded-host'] ?? '').toString().split(',')[0].trim();
    const protocol = forwardedProto || (request as { protocol?: string }).protocol || 'https';
    const host = forwardedHost || (request.headers.host ?? '') || '';
    return `${protocol}://${host}${request.url}`;
  }
}

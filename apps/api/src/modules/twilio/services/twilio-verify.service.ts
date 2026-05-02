import { Inject, Injectable, Logger } from '@nestjs/common';
import { ProviderError, ProviderType } from '@nexconnect/core';
import {
  CREDENTIAL_RESOLVER,
  CredentialResolver,
} from '../../providers/credential.resolver';
import { TwilioClientFactory } from '../twilio-client.factory';
import { TwilioErrorMapper } from '../twilio-error.mapper';

export interface StartVerificationInput {
  to: string;
  channel: 'sms' | 'call' | 'email' | 'whatsapp';
  locale?: string;
  customCode?: string;
  customFriendlyName?: string;
}

export interface CheckVerificationInput {
  to: string;
  code: string;
}

@Injectable()
export class TwilioVerifyService {
  private readonly logger = new Logger(TwilioVerifyService.name);

  constructor(
    private readonly factory: TwilioClientFactory,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  async startVerification(
    credentialId: string,
    input: StartVerificationInput,
  ): Promise<{ sid: string; status: string; channel: string }> {
    const creds = await this.credentials.resolveTwilio(credentialId, ProviderType.TWILIO_VERIFY);
    if (!creds.verifyServiceSid) {
      throw new ProviderError(
        ProviderType.TWILIO_VERIFY,
        'MISSING_VERIFY_SERVICE_SID',
        'verifyServiceSid is required on credentials',
        false,
      );
    }
    const client = this.factory.fromCredentials(creds);
    try {
      const verification = await client.verify.v2
        .services(creds.verifyServiceSid)
        .verifications.create({
          to: input.to,
          channel: input.channel,
          locale: input.locale,
          customCode: input.customCode,
          customFriendlyName: input.customFriendlyName,
        });
      await this.credentials.touch(credentialId);

      this.logger.log(
        { sid: verification.sid, status: verification.status, channel: input.channel },
        'twilio.verify.start',
      );
      return {
        sid: verification.sid,
        status: verification.status,
        channel: input.channel,
      };
    } catch (err) {
      throw TwilioErrorMapper.from(ProviderType.TWILIO_VERIFY, err);
    }
  }

  async checkVerification(
    credentialId: string,
    input: CheckVerificationInput,
  ): Promise<{ status: string; valid: boolean }> {
    const creds = await this.credentials.resolveTwilio(credentialId, ProviderType.TWILIO_VERIFY);
    if (!creds.verifyServiceSid) {
      throw new ProviderError(
        ProviderType.TWILIO_VERIFY,
        'MISSING_VERIFY_SERVICE_SID',
        'verifyServiceSid is required on credentials',
        false,
      );
    }
    const client = this.factory.fromCredentials(creds);
    try {
      const check = await client.verify.v2
        .services(creds.verifyServiceSid)
        .verificationChecks.create({ to: input.to, code: input.code });
      return {
        status: check.status,
        valid: check.status === 'approved',
      };
    } catch (err) {
      throw TwilioErrorMapper.from(ProviderType.TWILIO_VERIFY, err);
    }
  }
}

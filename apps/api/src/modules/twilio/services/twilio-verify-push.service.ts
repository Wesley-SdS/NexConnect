import { Inject, Injectable, Logger } from '@nestjs/common';
import { ProviderError, ProviderType } from '@nexconnect/core';
import {
  CREDENTIAL_RESOLVER,
  CredentialResolver,
} from '../../providers/credential.resolver';
import { TwilioClientFactory } from '../twilio-client.factory';
import { TwilioErrorMapper } from '../twilio-error.mapper';

export type FactorType = 'push' | 'totp';

export interface CreateFactorInput {
  identity: string;
  friendlyName: string;
  factorType: FactorType;
  /** Push-only. */
  bindingPublicKey?: string;
  bindingAlgorithm?: string;
  notificationToken?: string;
  notificationPlatform?: 'apn' | 'fcm' | 'none';
}

export interface CreateChallengeInput {
  identity: string;
  factorSid: string;
  message?: string;
  details?: Record<string, unknown>;
  /** TOTP code submitted by the end user. */
  authPayload?: string;
}

/**
 * Twilio Verify Push & TOTP factor support. Wraps the Verify v2
 * Entities/Factors/Challenges resources for second-factor flows that
 * don't rely on a one-time SMS/voice/email/whatsapp code.
 *
 * https://www.twilio.com/docs/verify/quickstarts/push
 */
@Injectable()
export class TwilioVerifyPushService {
  private readonly logger = new Logger(TwilioVerifyPushService.name);

  constructor(
    private readonly factory: TwilioClientFactory,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  async createFactor(credentialId: string, input: CreateFactorInput) {
    const { client, serviceSid } = await this.resolveServiceClient(credentialId);
    try {
      const factor = await client.verify.v2
        .services(serviceSid)
        .entities(input.identity)
        .newFactors.create({
          friendlyName: input.friendlyName,
          factorType: input.factorType,
          'binding.publicKey': input.bindingPublicKey,
          'binding.alg': input.bindingAlgorithm,
          'config.notificationToken': input.notificationToken,
          'config.notificationPlatform': input.notificationPlatform,
        } as never);
      this.logger.log(
        { sid: factor.sid, identity: input.identity, factorType: input.factorType },
        'twilio.verify.factor.created',
      );
      return {
        sid: factor.sid,
        status: factor.status,
        binding: factor.binding,
        config: factor.config,
      };
    } catch (err) {
      throw TwilioErrorMapper.from(ProviderType.TWILIO_VERIFY, err);
    }
  }

  async verifyFactor(credentialId: string, identity: string, factorSid: string, authPayload: string) {
    const { client, serviceSid } = await this.resolveServiceClient(credentialId);
    try {
      const factor = await client.verify.v2
        .services(serviceSid)
        .entities(identity)
        .factors(factorSid)
        .update({ authPayload });
      return { sid: factor.sid, status: factor.status };
    } catch (err) {
      throw TwilioErrorMapper.from(ProviderType.TWILIO_VERIFY, err);
    }
  }

  async createChallenge(credentialId: string, input: CreateChallengeInput) {
    const { client, serviceSid } = await this.resolveServiceClient(credentialId);
    try {
      const challenge = await client.verify.v2
        .services(serviceSid)
        .entities(input.identity)
        .challenges.create({
          factorSid: input.factorSid,
          ...(input.message ? { 'details.message': input.message } : {}),
          ...(input.details
            ? { 'details.fields': Object.entries(input.details).map(([k, v]) => ({ label: k, value: String(v) })) }
            : {}),
        } as never);
      return {
        sid: challenge.sid,
        status: challenge.status,
        expirationDate: challenge.expirationDate,
      };
    } catch (err) {
      throw TwilioErrorMapper.from(ProviderType.TWILIO_VERIFY, err);
    }
  }

  async approveChallenge(
    credentialId: string,
    identity: string,
    challengeSid: string,
    authPayload: string,
  ) {
    const { client, serviceSid } = await this.resolveServiceClient(credentialId);
    try {
      const challenge = await client.verify.v2
        .services(serviceSid)
        .entities(identity)
        .challenges(challengeSid)
        .update({ authPayload });
      return { sid: challenge.sid, status: challenge.status };
    } catch (err) {
      throw TwilioErrorMapper.from(ProviderType.TWILIO_VERIFY, err);
    }
  }

  async deleteFactor(credentialId: string, identity: string, factorSid: string): Promise<void> {
    const { client, serviceSid } = await this.resolveServiceClient(credentialId);
    try {
      await client.verify.v2
        .services(serviceSid)
        .entities(identity)
        .factors(factorSid)
        .remove();
    } catch (err) {
      throw TwilioErrorMapper.from(ProviderType.TWILIO_VERIFY, err);
    }
  }

  // ─── private ─────────────────────────────────────────

  private async resolveServiceClient(credentialId: string) {
    const creds = await this.credentials.resolveTwilio(credentialId, ProviderType.TWILIO_VERIFY);
    if (!creds.verifyServiceSid) {
      throw new ProviderError(
        ProviderType.TWILIO_VERIFY,
        'MISSING_VERIFY_SERVICE_SID',
        'verifyServiceSid is required on credentials',
        false,
      );
    }
    return {
      client: this.factory.fromCredentials(creds),
      serviceSid: creds.verifyServiceSid,
    };
  }
}

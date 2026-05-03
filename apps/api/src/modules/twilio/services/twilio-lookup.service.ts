import { Inject, Injectable, Logger } from '@nestjs/common';
import { ProviderType } from '@nexconnect/core';
import {
  CREDENTIAL_RESOLVER,
  CredentialResolver,
} from '../../providers/credential.resolver';
import { TwilioClientFactory } from '../twilio-client.factory';
import { TwilioErrorMapper } from '../twilio-error.mapper';

export interface LookupResult {
  phoneNumber: string;
  countryCode?: string;
  nationalFormat?: string;
  valid: boolean;
  carrierName?: string;
  carrierType?: string;
  callerName?: string;
  raw?: unknown;
}

/**
 * Twilio Lookup v2 — phone number validation + carrier metadata.
 * https://www.twilio.com/docs/lookup
 */
@Injectable()
export class TwilioLookupService {
  private readonly logger = new Logger(TwilioLookupService.name);

  constructor(
    private readonly factory: TwilioClientFactory,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  async lookup(
    credentialId: string,
    phone: string,
    fields: Array<'line_type_intelligence' | 'caller_name' | 'identity_match' | 'sim_swap'> = ['line_type_intelligence'],
  ): Promise<LookupResult> {
    const creds = await this.credentials.resolveTwilio(credentialId);
    const client = this.factory.fromCredentials(creds);
    try {
      const result = await client.lookups.v2.phoneNumbers(phone).fetch({ fields: fields.join(',') });
      this.logger.debug(
        { phone, valid: result.valid, country: result.countryCode },
        'twilio.lookup.fetched',
      );
      const lineType = result.lineTypeIntelligence as { carrier_name?: string; carrierName?: string; type?: string } | undefined;
      const callerName = result.callerName as { caller_name?: string; callerName?: string } | undefined;
      return {
        phoneNumber: result.phoneNumber,
        countryCode: result.countryCode,
        nationalFormat: result.nationalFormat,
        valid: Boolean(result.valid),
        carrierName: lineType?.carrier_name ?? lineType?.carrierName,
        carrierType: lineType?.type,
        callerName: callerName?.caller_name ?? callerName?.callerName,
        raw: result,
      };
    } catch (err) {
      throw TwilioErrorMapper.from(ProviderType.TWILIO_SMS, err);
    }
  }
}

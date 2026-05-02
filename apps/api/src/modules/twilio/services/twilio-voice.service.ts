import { Inject, Injectable, Logger } from '@nestjs/common';
import { ProviderError, ProviderType } from '@nexconnect/core';
import { PhoneUtil } from '@nexconnect/shared';
import {
  CREDENTIAL_RESOLVER,
  CredentialResolver,
} from '../../providers/credential.resolver';
import { TwilioClientFactory } from '../twilio-client.factory';
import { TwilioErrorMapper } from '../twilio-error.mapper';

export interface MakeCallInput {
  to: string;
  from?: string;
  twimlUrl?: string;
  twiml?: string;
  statusCallback?: string;
  statusCallbackEvent?: Array<'initiated' | 'ringing' | 'answered' | 'completed'>;
  statusCallbackMethod?: 'GET' | 'POST';
  record?: boolean;
  machineDetection?: 'Enable' | 'DetectMessageEnd';
  timeout?: number;
}

export interface CallResult {
  sid: string;
  status: string;
  startTime?: Date | null;
  direction: string;
}

@Injectable()
export class TwilioVoiceService {
  private readonly logger = new Logger(TwilioVoiceService.name);

  constructor(
    private readonly factory: TwilioClientFactory,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  async makeCall(credentialId: string, input: MakeCallInput): Promise<CallResult> {
    const creds = await this.credentials.resolveTwilio(credentialId, ProviderType.TWILIO_VOICE);
    const client = this.factory.fromCredentials(creds);
    const from = this.normalize(input.from ?? creds.fromNumber);
    if (!from) {
      throw new ProviderError(
        ProviderType.TWILIO_VOICE,
        'MISSING_FROM_NUMBER',
        'A from number is required to place a call',
        false,
      );
    }

    try {
      const call = await client.calls.create({
        to: this.normalize(input.to)!,
        from,
        url: input.twimlUrl,
        twiml: input.twiml,
        statusCallback: input.statusCallback ?? process.env.TWILIO_STATUS_CALLBACK_URL,
        statusCallbackEvent: input.statusCallbackEvent ?? ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: input.statusCallbackMethod ?? 'POST',
        record: input.record ?? false,
        machineDetection: input.machineDetection,
        timeout: input.timeout ?? 60,
      });
      await this.credentials.touch(credentialId);

      this.logger.log(
        { callSid: call.sid, to: input.to, from, status: call.status },
        'twilio.voice.call.created',
      );

      return {
        sid: call.sid,
        status: call.status,
        startTime: call.startTime,
        direction: call.direction,
      };
    } catch (err) {
      throw TwilioErrorMapper.from(ProviderType.TWILIO_VOICE, err);
    }
  }

  async endCall(credentialId: string, callSid: string): Promise<void> {
    const creds = await this.credentials.resolveTwilio(credentialId, ProviderType.TWILIO_VOICE);
    const client = this.factory.fromCredentials(creds);
    try {
      await client.calls(callSid).update({ status: 'completed' });
      this.logger.log({ callSid }, 'twilio.voice.call.ended');
    } catch (err) {
      throw TwilioErrorMapper.from(ProviderType.TWILIO_VOICE, err);
    }
  }

  async fetchCall(credentialId: string, callSid: string) {
    const creds = await this.credentials.resolveTwilio(credentialId, ProviderType.TWILIO_VOICE);
    const client = this.factory.fromCredentials(creds);
    try {
      return await client.calls(callSid).fetch();
    } catch (err) {
      throw TwilioErrorMapper.from(ProviderType.TWILIO_VOICE, err);
    }
  }

  private normalize(phone: string | undefined): string | undefined {
    if (!phone) return undefined;
    if (phone.startsWith('+')) return phone;
    const normalized = PhoneUtil.normalize(phone);
    return normalized ? `+${normalized}` : undefined;
  }
}

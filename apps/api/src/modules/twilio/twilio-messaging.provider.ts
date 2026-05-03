import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IMessagingProvider,
  OutboundMessage,
  ProviderCapability,
  ProviderChannel,
  ProviderContext,
  ProviderError,
  ProviderSendResult,
  ProviderType,
} from '@nexconnect/core';
import {
  CREDENTIAL_RESOLVER,
  CredentialResolver,
} from '../providers/credential.resolver';
import { TwilioClientFactory } from './twilio-client.factory';
import { TwilioErrorMapper } from './twilio-error.mapper';
import { TwilioMessagingMapper } from './twilio-messaging.mapper';

const SHARED_CAPABILITIES: ReadonlySet<ProviderCapability> = new Set([
  ProviderCapability.SEND_TEXT,
  ProviderCapability.SEND_IMAGE,
  ProviderCapability.SEND_VIDEO,
  ProviderCapability.SEND_AUDIO,
  ProviderCapability.SEND_DOCUMENT,
  ProviderCapability.SEND_LOCATION,
  ProviderCapability.UPLOAD_MEDIA,
]);

const WA_CAPABILITIES: ReadonlySet<ProviderCapability> = new Set([
  ...SHARED_CAPABILITIES,
  ProviderCapability.SEND_STICKER,
  ProviderCapability.SEND_TEMPLATE,
  ProviderCapability.SEND_REPLY,
]);

export abstract class TwilioMessagingProvider implements IMessagingProvider {
  abstract readonly type:
    | ProviderType.TWILIO_SMS
    | ProviderType.TWILIO_WHATSAPP
    | ProviderType.TWILIO_RCS;
  abstract readonly channel: ProviderChannel;
  abstract readonly capabilities: ReadonlySet<ProviderCapability>;
  protected abstract readonly twilioChannel: 'sms' | 'whatsapp' | 'rcs';

  protected readonly logger: Logger;

  constructor(
    protected readonly factory: TwilioClientFactory,
    protected readonly mapper: TwilioMessagingMapper,
    @Inject(CREDENTIAL_RESOLVER) protected readonly credentials: CredentialResolver,
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  supports(capability: ProviderCapability): boolean {
    return this.capabilities.has(capability);
  }

  async send(context: ProviderContext, message: OutboundMessage): Promise<ProviderSendResult> {
    const creds = await this.credentials.resolveTwilio(context.credentialId, this.type);
    const client = this.factory.fromCredentials(creds);

    try {
      const options = this.mapper.toCreateMessageOptions({
        message,
        channel: this.twilioChannel,
        from: creds.fromNumber,
        messagingServiceSid: creds.messagingServiceSid,
        statusCallback: process.env.TWILIO_STATUS_CALLBACK_URL,
        providerType: this.type,
      });

      const response = await client.messages.create(options);
      await this.credentials.touch(context.credentialId);

      this.logger.log(
        {
          tenantId: context.tenantId,
          instanceId: context.instanceId,
          externalId: response.sid,
          to: message.to,
          channel: this.twilioChannel,
        },
        'twilio.message.accepted',
      );

      return {
        ok: true,
        provider: this.type,
        externalMessageId: response.sid,
        recipientId: response.to,
        acceptedAt: new Date(),
        raw: {
          sid: response.sid,
          status: response.status,
          price: response.price,
          priceUnit: response.priceUnit,
          direction: response.direction,
        },
      };
    } catch (err) {
      const mapped = err instanceof ProviderError ? err : TwilioErrorMapper.from(this.type, err);
      this.logger.warn(
        {
          code: mapped.code,
          retryable: mapped.retryable,
          tenantId: context.tenantId,
          to: message.to,
        },
        'twilio.message.failed',
      );
      return {
        ok: false,
        provider: this.type,
        code: mapped.code,
        message: mapped.message,
        retryable: mapped.retryable,
        httpStatus: mapped.httpStatus,
        raw: mapped.raw,
      };
    }
  }
}

@Injectable()
export class TwilioSmsProvider extends TwilioMessagingProvider {
  readonly type = ProviderType.TWILIO_SMS;
  readonly channel = ProviderChannel.SMS;
  readonly capabilities = SHARED_CAPABILITIES;
  protected readonly twilioChannel = 'sms' as const;
}

@Injectable()
export class TwilioWhatsAppProvider extends TwilioMessagingProvider {
  readonly type = ProviderType.TWILIO_WHATSAPP;
  readonly channel = ProviderChannel.WHATSAPP;
  readonly capabilities = WA_CAPABILITIES;
  protected readonly twilioChannel = 'whatsapp' as const;
}

@Injectable()
export class TwilioRcsProvider extends TwilioMessagingProvider {
  readonly type = ProviderType.TWILIO_RCS;
  readonly channel = ProviderChannel.RCS;
  readonly capabilities = WA_CAPABILITIES;
  protected readonly twilioChannel = 'rcs' as const;
}

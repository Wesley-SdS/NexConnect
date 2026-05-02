import { ProviderType } from './provider-type.enum';

export interface MetaWhatsAppCloudCredentials {
  type: ProviderType.META_WHATSAPP_CLOUD;
  businessAccountId: string;
  phoneNumberId: string;
  accessToken: string;
  appSecret: string;
  webhookVerifyToken: string;
  graphApiVersion?: string;
}

export interface MetaInstagramCredentials {
  type: ProviderType.META_INSTAGRAM;
  instagramBusinessAccountId: string;
  pageId: string;
  pageAccessToken: string;
  appSecret: string;
  webhookVerifyToken: string;
  graphApiVersion?: string;
}

export interface MetaMessengerCredentials {
  type: ProviderType.META_MESSENGER;
  pageId: string;
  pageAccessToken: string;
  appSecret: string;
  webhookVerifyToken: string;
  graphApiVersion?: string;
}

export interface TwilioCredentials {
  type:
    | ProviderType.TWILIO_SMS
    | ProviderType.TWILIO_WHATSAPP
    | ProviderType.TWILIO_VOICE
    | ProviderType.TWILIO_VERIFY;
  accountSid: string;
  authToken: string;
  apiKeySid?: string;
  apiKeySecret?: string;
  messagingServiceSid?: string;
  verifyServiceSid?: string;
  applicationSid?: string;
  fromNumber?: string;
}

export type ProviderCredentialData =
  | MetaWhatsAppCloudCredentials
  | MetaInstagramCredentials
  | MetaMessengerCredentials
  | TwilioCredentials;

export function isMetaCredentials(
  data: ProviderCredentialData,
): data is MetaWhatsAppCloudCredentials | MetaInstagramCredentials | MetaMessengerCredentials {
  return (
    data.type === ProviderType.META_WHATSAPP_CLOUD ||
    data.type === ProviderType.META_INSTAGRAM ||
    data.type === ProviderType.META_MESSENGER
  );
}

export function isTwilioCredentials(data: ProviderCredentialData): data is TwilioCredentials {
  return (
    data.type === ProviderType.TWILIO_SMS ||
    data.type === ProviderType.TWILIO_WHATSAPP ||
    data.type === ProviderType.TWILIO_VOICE ||
    data.type === ProviderType.TWILIO_VERIFY
  );
}

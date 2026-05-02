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
    | ProviderType.TWILIO_VERIFY
    | ProviderType.TWILIO_RCS;
  accountSid: string;
  authToken: string;
  apiKeySid?: string;
  apiKeySecret?: string;
  messagingServiceSid?: string;
  verifyServiceSid?: string;
  applicationSid?: string;
  fromNumber?: string;
}

export interface TelegramCredentials {
  type: ProviderType.TELEGRAM;
  botToken: string;
  /**
   * Header secret echoed back by Telegram on every webhook delivery
   * (X-Telegram-Bot-Api-Secret-Token). Required for production webhooks.
   */
  webhookSecretToken: string;
  /** Bot's @username (without @). Used for slash command routing. */
  botUsername?: string;
  /** Optional Telegram Bot API base URL override (self-hosted Bot API server). */
  apiBaseUrl?: string;
}

export interface DiscordCredentials {
  type: ProviderType.DISCORD;
  applicationId: string;
  /** Ed25519 public key (hex) used to verify interactions endpoint signatures. */
  publicKey: string;
  botToken: string;
  /** Optional default guild for command registration. */
  guildId?: string;
}

export interface SlackCredentials {
  type: ProviderType.SLACK;
  /** xoxb-... bot user OAuth token. */
  botToken: string;
  /** Used to validate X-Slack-Signature on webhooks. */
  signingSecret: string;
  /** Slack workspace / team id (T...). */
  teamId?: string;
  appId?: string;
  /** xoxa-... user token (optional). */
  userToken?: string;
  /** Used by OAuth flow to bootstrap fresh installs. */
  clientId?: string;
  clientSecret?: string;
}

export type ProviderCredentialData =
  | MetaWhatsAppCloudCredentials
  | MetaInstagramCredentials
  | MetaMessengerCredentials
  | TwilioCredentials
  | TelegramCredentials
  | DiscordCredentials
  | SlackCredentials;

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
    data.type === ProviderType.TWILIO_VERIFY ||
    data.type === ProviderType.TWILIO_RCS
  );
}

export function isTelegramCredentials(data: ProviderCredentialData): data is TelegramCredentials {
  return data.type === ProviderType.TELEGRAM;
}

export function isDiscordCredentials(data: ProviderCredentialData): data is DiscordCredentials {
  return data.type === ProviderType.DISCORD;
}

export function isSlackCredentials(data: ProviderCredentialData): data is SlackCredentials {
  return data.type === ProviderType.SLACK;
}

import { HttpClient } from '../http-client';

export type ProviderType =
  | 'BAILEYS'
  | 'META_WHATSAPP_CLOUD'
  | 'META_INSTAGRAM'
  | 'META_MESSENGER'
  | 'TWILIO_SMS'
  | 'TWILIO_WHATSAPP'
  | 'TWILIO_VOICE'
  | 'TWILIO_VERIFY'
  | 'TWILIO_RCS'
  | 'TELEGRAM'
  | 'DISCORD'
  | 'SLACK';

export type ProviderCredentialStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'ERROR';

export interface MetaWhatsAppCloudCredentials {
  businessAccountId: string;
  phoneNumberId: string;
  accessToken: string;
  appSecret: string;
  webhookVerifyToken: string;
  graphApiVersion?: string;
}

export interface MetaInstagramCredentials {
  instagramBusinessAccountId: string;
  pageId: string;
  pageAccessToken: string;
  appSecret: string;
  webhookVerifyToken: string;
  graphApiVersion?: string;
}

export interface MetaMessengerCredentials {
  pageId: string;
  pageAccessToken: string;
  appSecret: string;
  webhookVerifyToken: string;
  graphApiVersion?: string;
}

export interface TwilioCredentials {
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
  botToken: string;
  webhookSecretToken: string;
  botUsername?: string;
  apiBaseUrl?: string;
}

export interface DiscordCredentials {
  applicationId: string;
  publicKey: string;
  botToken: string;
  guildId?: string;
}

export interface SlackCredentials {
  botToken: string;
  signingSecret: string;
  teamId?: string;
  appId?: string;
  userToken?: string;
  clientId?: string;
  clientSecret?: string;
}

export type CredentialPayload =
  | MetaWhatsAppCloudCredentials
  | MetaInstagramCredentials
  | MetaMessengerCredentials
  | TwilioCredentials
  | TelegramCredentials
  | DiscordCredentials
  | SlackCredentials;

export interface CreateCredentialRequest {
  provider: ProviderType;
  displayName: string;
  instanceId?: string;
  credentials: CredentialPayload;
  webhookCallbackUrl?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateCredentialRequest {
  displayName?: string;
  credentials?: CredentialPayload;
  webhookCallbackUrl?: string;
  status?: ProviderCredentialStatus;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
}

export interface ProviderCredential {
  id: string;
  tenantId: string;
  instanceId: string | null;
  provider: ProviderType;
  displayName: string;
  externalAccountId: string | null;
  externalPhoneId: string | null;
  phoneNumber: string | null;
  webhookCallbackUrl: string | null;
  status: ProviderCredentialStatus;
  lastUsedAt: string | null;
  lastRotatedAt: string | null;
  expiresAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListCredentialsParams {
  provider?: ProviderType;
  instanceId?: string;
}

/**
 * Manage Meta and Twilio provider credentials. The plaintext credential
 * payload is only accepted on `create()` / `update()` — responses never
 * include the raw secrets.
 */
export class ProvidersResource {
  constructor(private readonly http: HttpClient) {}

  async createCredential(data: CreateCredentialRequest): Promise<ProviderCredential> {
    return this.http.post<ProviderCredential>('/providers/credentials', { body: data });
  }

  async listCredentials(params?: ListCredentialsParams): Promise<ProviderCredential[]> {
    return this.http.get<ProviderCredential[]>('/providers/credentials', {
      query: params as Record<string, string | number | boolean | undefined> | undefined,
    });
  }

  async getCredential(id: string): Promise<ProviderCredential> {
    return this.http.get<ProviderCredential>(`/providers/credentials/${id}`);
  }

  async updateCredential(
    id: string,
    data: UpdateCredentialRequest,
  ): Promise<ProviderCredential> {
    return this.http.patch<ProviderCredential>(`/providers/credentials/${id}`, { body: data });
  }

  /** Convenience: rotate the secret material without touching the display name or status. */
  async rotateCredential(
    id: string,
    credentials: CredentialPayload,
  ): Promise<ProviderCredential> {
    return this.updateCredential(id, { credentials });
  }

  async deleteCredential(id: string): Promise<void> {
    await this.http.delete(`/providers/credentials/${id}`);
  }
}

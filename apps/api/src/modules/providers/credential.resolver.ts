import {
  MetaInstagramCredentials,
  MetaMessengerCredentials,
  MetaWhatsAppCloudCredentials,
  ProviderCredentialData,
  ProviderType,
  TwilioCredentials,
} from '@nexconnect/core';

export interface CredentialResolver {
  resolve(credentialId: string): Promise<ProviderCredentialData>;
  resolveMetaWhatsApp(credentialId: string): Promise<MetaWhatsAppCloudCredentials>;
  resolveMetaInstagram(credentialId: string): Promise<MetaInstagramCredentials>;
  resolveMetaMessenger(credentialId: string): Promise<MetaMessengerCredentials>;
  resolveTwilio(credentialId: string, expectedType?: ProviderType): Promise<TwilioCredentials>;

  findByExternalPhoneId(phoneNumberId: string): Promise<{
    credentialId: string;
    tenantId: string;
    instanceId: string | null;
    provider: ProviderType;
  } | null>;

  findByPageId(pageId: string): Promise<{
    credentialId: string;
    tenantId: string;
    instanceId: string | null;
    provider: ProviderType;
  } | null>;

  findByAccountSid(accountSid: string): Promise<{
    credentialId: string;
    tenantId: string;
    instanceId: string | null;
    provider: ProviderType;
  } | null>;

  touch(credentialId: string): Promise<void>;
}

export const CREDENTIAL_RESOLVER = Symbol('CREDENTIAL_RESOLVER');

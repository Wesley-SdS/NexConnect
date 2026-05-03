import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IProviderLifecycle,
  MetaWhatsAppCloudCredentials,
  ProviderContext,
  ProviderType,
} from '@nexconnect/core';
import {
  CREDENTIAL_RESOLVER,
  CredentialResolver,
} from '../../providers/credential.resolver';
import { WhatsAppCloudClient } from '../whatsapp-cloud/whatsapp-cloud.client';

/**
 * Hooks the Meta WhatsApp Business Account into NexConnect's webhook
 * configuration on credential creation. Calls
 *
 *   POST {business_account_id}/subscribed_apps
 *
 * which is idempotent — re-running it is safe and only re-confirms the
 * subscription. Without this call, Meta will not deliver any inbound
 * webhook events for the account.
 */
@Injectable()
export class MetaCredentialLifecycle implements IProviderLifecycle {
  private readonly logger = new Logger(MetaCredentialLifecycle.name);

  constructor(
    private readonly whatsappClient: WhatsAppCloudClient,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  async onCredentialCreated(context: ProviderContext): Promise<void> {
    await this.subscribe(context);
  }

  async onCredentialRotated(context: ProviderContext): Promise<void> {
    // Tokens rotate but the subscription survives. Still, re-call so a
    // newly issued token is the one bound to the subscription channel.
    await this.subscribe(context);
  }

  async onCredentialRevoked(_context: ProviderContext): Promise<void> {
    // We intentionally do NOT call DELETE /subscribed_apps because the
    // tenant may have multiple credentials sharing the same WABA. The
    // operator can revoke at the Meta dashboard level if needed.
  }

  private async subscribe(context: ProviderContext): Promise<void> {
    const data = await this.credentials.resolve(context.credentialId);
    if (data.type !== ProviderType.META_WHATSAPP_CLOUD) return;
    const creds = data as MetaWhatsAppCloudCredentials;

    try {
      await this.whatsappClient.subscribeToApp({
        accessToken: creds.accessToken,
        phoneNumberId: creds.phoneNumberId,
        businessAccountId: creds.businessAccountId,
        apiVersion: creds.graphApiVersion,
      });
      this.logger.log(
        { credentialId: context.credentialId, businessAccountId: creds.businessAccountId },
        'meta.whatsapp.subscribe-to-app.ok',
      );
    } catch (err) {
      this.logger.warn(
        { credentialId: context.credentialId, err: (err as Error).message },
        'meta.whatsapp.subscribe-to-app.failed',
      );
    }
  }
}

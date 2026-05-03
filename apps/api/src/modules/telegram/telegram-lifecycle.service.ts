import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IProviderLifecycle,
  ProviderContext,
  ProviderType,
  TelegramCredentials,
} from '@nexconnect/core';
import {
  CREDENTIAL_RESOLVER,
  CredentialResolver,
} from '../providers/credential.resolver';
import { TelegramClient } from './telegram.client';

/**
 * On credential create / rotate, registers the public webhook URL with
 * Telegram via setWebhook. On revoke, removes the webhook (deleteWebhook).
 *
 * Uses TELEGRAM_PUBLIC_URL or APP_PUBLIC_URL env to compose the public
 * callback. If neither is set, logs a warning and skips — the operator
 * can run the registration manually later.
 */
@Injectable()
export class TelegramLifecycleService implements IProviderLifecycle {
  private readonly logger = new Logger(TelegramLifecycleService.name);

  constructor(
    private readonly client: TelegramClient,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  async onCredentialCreated(context: ProviderContext): Promise<void> {
    await this.registerWebhook(context);
  }

  async onCredentialRotated(context: ProviderContext): Promise<void> {
    await this.registerWebhook(context);
  }

  async onCredentialRevoked(context: ProviderContext): Promise<void> {
    const data = await this.credentials.resolve(context.credentialId);
    if (data.type !== ProviderType.TELEGRAM) return;
    try {
      await this.client.deleteWebhook({ botToken: data.botToken, apiBaseUrl: data.apiBaseUrl }, true);
      this.logger.log({ credentialId: context.credentialId }, 'telegram.webhook.removed');
    } catch (err) {
      this.logger.warn(
        { credentialId: context.credentialId, err: (err as Error).message },
        'telegram.webhook.remove.failed',
      );
    }
  }

  private async registerWebhook(context: ProviderContext): Promise<void> {
    const data = await this.credentials.resolve(context.credentialId);
    if (data.type !== ProviderType.TELEGRAM) return;
    const creds = data as TelegramCredentials;

    const publicUrl = process.env.TELEGRAM_PUBLIC_URL ?? process.env.APP_PUBLIC_URL;
    if (!publicUrl) {
      this.logger.warn(
        { credentialId: context.credentialId },
        'telegram.lifecycle.no-public-url-skipping-setWebhook',
      );
      return;
    }
    const callbackPath = process.env.TELEGRAM_WEBHOOK_CALLBACK_PATH ?? '/v1/webhooks/telegram';
    const url = `${publicUrl.replace(/\/+$/, '')}${callbackPath}/${context.credentialId}`;

    try {
      await this.client.setWebhook(
        { botToken: creds.botToken, apiBaseUrl: creds.apiBaseUrl },
        {
          url,
          allowed_updates: [
            'message',
            'edited_message',
            'channel_post',
            'callback_query',
            'poll_answer',
            'my_chat_member',
          ],
          secret_token: creds.webhookSecretToken,
          drop_pending_updates: false,
        },
      );
      this.logger.log({ credentialId: context.credentialId, url }, 'telegram.webhook.registered');
    } catch (err) {
      this.logger.error(
        { credentialId: context.credentialId, err: (err as Error).message },
        'telegram.webhook.register.failed',
      );
    }
  }
}

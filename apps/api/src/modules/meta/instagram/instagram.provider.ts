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
} from '../../providers/credential.resolver';
import { InstagramClient } from './instagram.client';
import { InstagramMapper } from './instagram.mapper';

const CAPABILITIES: ReadonlySet<ProviderCapability> = new Set([
  ProviderCapability.SEND_TEXT,
  ProviderCapability.SEND_IMAGE,
  ProviderCapability.SEND_VIDEO,
  ProviderCapability.SEND_AUDIO,
  ProviderCapability.SEND_DOCUMENT,
  ProviderCapability.SEND_INTERACTIVE_BUTTONS,
  ProviderCapability.MARK_READ,
  ProviderCapability.TYPING_INDICATOR,
]);

@Injectable()
export class InstagramProvider implements IMessagingProvider {
  readonly type = ProviderType.META_INSTAGRAM;
  readonly channel = ProviderChannel.INSTAGRAM_DM;
  readonly capabilities = CAPABILITIES;

  private readonly logger = new Logger(InstagramProvider.name);

  constructor(
    private readonly client: InstagramClient,
    private readonly mapper: InstagramMapper,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  supports(capability: ProviderCapability): boolean {
    return this.capabilities.has(capability);
  }

  async send(context: ProviderContext, message: OutboundMessage): Promise<ProviderSendResult> {
    const creds = await this.credentials.resolveMetaInstagram(context.credentialId);
    try {
      const input = this.mapper.toClientInput(message);
      const response = await this.client.sendMessage(
        {
          pageAccessToken: creds.pageAccessToken,
          pageId: creds.pageId,
          instagramBusinessAccountId: creds.instagramBusinessAccountId,
          apiVersion: creds.graphApiVersion,
        },
        input,
      );
      await this.credentials.touch(context.credentialId);

      this.logger.log(
        { messageId: response.message_id, to: message.to, tenantId: context.tenantId },
        'meta.instagram.message.accepted',
      );

      return {
        ok: true,
        provider: this.type,
        externalMessageId: response.message_id,
        recipientId: response.recipient_id,
        acceptedAt: new Date(),
        raw: response,
      };
    } catch (err) {
      if (err instanceof ProviderError) {
        return {
          ok: false,
          provider: this.type,
          code: err.code,
          message: err.message,
          retryable: err.retryable,
          retryAfterMs: err.retryAfterMs,
          httpStatus: err.httpStatus,
          raw: err.raw,
        };
      }
      const error = err as Error;
      this.logger.error(
        { error: error.message, stack: error.stack, tenantId: context.tenantId },
        'meta.instagram.send.unexpected-error',
      );
      return {
        ok: false,
        provider: this.type,
        code: 'UNEXPECTED_ERROR',
        message: error.message,
        retryable: true,
      };
    }
  }

  async markAsRead(context: ProviderContext, senderId: string): Promise<void> {
    const creds = await this.credentials.resolveMetaInstagram(context.credentialId);
    await this.client.markSeen(
      {
        pageAccessToken: creds.pageAccessToken,
        pageId: creds.pageId,
        instagramBusinessAccountId: creds.instagramBusinessAccountId,
        apiVersion: creds.graphApiVersion,
      },
      senderId,
    );
  }

  async setTypingIndicator(
    context: ProviderContext,
    senderId: string,
    state: 'on' | 'off',
  ): Promise<void> {
    const creds = await this.credentials.resolveMetaInstagram(context.credentialId);
    await this.client.typingOn(
      {
        pageAccessToken: creds.pageAccessToken,
        pageId: creds.pageId,
        instagramBusinessAccountId: creds.instagramBusinessAccountId,
        apiVersion: creds.graphApiVersion,
      },
      senderId,
      state === 'on',
    );
  }
}

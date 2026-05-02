import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IMessagingProvider,
  MessageType,
  OutboundMessage,
  ProviderCapability,
  ProviderChannel,
  ProviderContext,
  ProviderError,
  ProviderSendResult,
  ProviderType,
  ProviderUnsupportedOperationError,
  ProviderValidationError,
} from '@nexconnect/core';
import {
  CREDENTIAL_RESOLVER,
  CredentialResolver,
} from '../../providers/credential.resolver';
import { MessengerClient, MessengerSendMessageInput } from './messenger.client';

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
export class MessengerProvider implements IMessagingProvider {
  readonly type = ProviderType.META_MESSENGER;
  readonly channel = ProviderChannel.MESSENGER;
  readonly capabilities = CAPABILITIES;

  private readonly logger = new Logger(MessengerProvider.name);

  constructor(
    private readonly client: MessengerClient,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  supports(capability: ProviderCapability): boolean {
    return this.capabilities.has(capability);
  }

  async send(context: ProviderContext, message: OutboundMessage): Promise<ProviderSendResult> {
    const creds = await this.credentials.resolveMetaMessenger(context.credentialId);
    try {
      const input = this.toClientInput(message);
      const response = await this.client.sendMessage(
        {
          pageAccessToken: creds.pageAccessToken,
          pageId: creds.pageId,
          apiVersion: creds.graphApiVersion,
        },
        input,
      );
      await this.credentials.touch(context.credentialId);

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
      this.logger.error({ error: error.message, stack: error.stack }, 'meta.messenger.send.failed');
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
    const creds = await this.credentials.resolveMetaMessenger(context.credentialId);
    await this.client.markSeen(
      { pageAccessToken: creds.pageAccessToken, pageId: creds.pageId, apiVersion: creds.graphApiVersion },
      senderId,
    );
  }

  async setTypingIndicator(
    context: ProviderContext,
    senderId: string,
    state: 'on' | 'off',
  ): Promise<void> {
    const creds = await this.credentials.resolveMetaMessenger(context.credentialId);
    await this.client.typing(
      { pageAccessToken: creds.pageAccessToken, pageId: creds.pageId, apiVersion: creds.graphApiVersion },
      senderId,
      state === 'on',
    );
  }

  private toClientInput(message: OutboundMessage): MessengerSendMessageInput {
    if (!message.to) {
      throw new ProviderValidationError(ProviderType.META_MESSENGER, 'Recipient ID is required');
    }
    switch (message.type) {
      case MessageType.TEXT:
        return { recipientId: message.to, messageText: message.text };
      case MessageType.IMAGE:
        return this.mapAttachment(message.to, message.media?.url, 'image');
      case MessageType.VIDEO:
        return this.mapAttachment(message.to, message.media?.url, 'video');
      case MessageType.AUDIO:
        return this.mapAttachment(message.to, message.media?.url, 'audio');
      case MessageType.DOCUMENT:
        return this.mapAttachment(message.to, message.media?.url, 'file');
      case MessageType.BUTTON_REPLY:
        return {
          recipientId: message.to,
          messageText: message.body,
          quickReplies: message.buttons.map((b) => ({ title: b.title, payload: b.id })),
        };
      default:
        throw new ProviderUnsupportedOperationError(ProviderType.META_MESSENGER, `send:${message.type}`);
    }
  }

  private mapAttachment(
    recipientId: string,
    url: string | undefined,
    type: 'image' | 'video' | 'audio' | 'file',
  ): MessengerSendMessageInput {
    if (!url) {
      throw new ProviderValidationError(
        ProviderType.META_MESSENGER,
        `Attachment URL is required for ${type}`,
      );
    }
    return { recipientId, attachmentUrl: url, attachmentType: type };
  }
}

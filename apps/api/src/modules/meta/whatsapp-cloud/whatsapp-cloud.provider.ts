import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IMessagingProvider,
  MediaUploadInput,
  MetaWhatsAppCloudCredentials,
  OutboundMessage,
  ProviderCapability,
  ProviderChannel,
  ProviderContext,
  ProviderError,
  ProviderMediaDownloadResult,
  ProviderMediaUploadResult,
  ProviderSendResult,
  ProviderType,
} from '@nexconnect/core';
import { createHash } from 'crypto';
import { CREDENTIAL_RESOLVER, CredentialResolver } from '../../providers/credential.resolver';
import { WhatsAppCloudClient } from './whatsapp-cloud.client';
import { WhatsAppCloudMapper } from './whatsapp-cloud.mapper';

const CAPABILITIES: ReadonlySet<ProviderCapability> = new Set([
  ProviderCapability.SEND_TEXT,
  ProviderCapability.SEND_IMAGE,
  ProviderCapability.SEND_VIDEO,
  ProviderCapability.SEND_AUDIO,
  ProviderCapability.SEND_DOCUMENT,
  ProviderCapability.SEND_STICKER,
  ProviderCapability.SEND_LOCATION,
  ProviderCapability.SEND_CONTACTS,
  ProviderCapability.SEND_TEMPLATE,
  ProviderCapability.SEND_INTERACTIVE_BUTTONS,
  ProviderCapability.SEND_INTERACTIVE_LIST,
  ProviderCapability.SEND_REACTION,
  ProviderCapability.SEND_REPLY,
  ProviderCapability.MARK_READ,
  ProviderCapability.TYPING_INDICATOR,
  ProviderCapability.UPLOAD_MEDIA,
  ProviderCapability.DOWNLOAD_MEDIA,
  ProviderCapability.TEMPLATE_MANAGEMENT,
]);

@Injectable()
export class WhatsAppCloudProvider implements IMessagingProvider {
  readonly type = ProviderType.META_WHATSAPP_CLOUD;
  readonly channel = ProviderChannel.WHATSAPP;
  readonly capabilities = CAPABILITIES;

  private readonly logger = new Logger(WhatsAppCloudProvider.name);

  constructor(
    private readonly client: WhatsAppCloudClient,
    private readonly mapper: WhatsAppCloudMapper,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  supports(capability: ProviderCapability): boolean {
    return this.capabilities.has(capability);
  }

  async send(context: ProviderContext, message: OutboundMessage): Promise<ProviderSendResult> {
    const creds = await this.credentials.resolveMetaWhatsApp(context.credentialId);
    try {
      const body = this.mapper.toGraphPayload(message);
      const response = await this.client.sendMessage(this.toClientConfig(creds), { body });
      await this.credentials.touch(context.credentialId);

      const externalId = response.messages?.[0]?.id;
      if (!externalId) {
        return {
          ok: false,
          provider: this.type,
          code: 'NO_MESSAGE_ID',
          message: 'Graph API accepted request but returned no message id',
          retryable: false,
          raw: response,
        };
      }

      this.logger.log(
        {
          tenantId: context.tenantId,
          instanceId: context.instanceId,
          externalId,
          to: message.to,
          correlationId: context.correlationId,
        },
        'meta.whatsapp.message.accepted',
      );

      return {
        ok: true,
        provider: this.type,
        externalMessageId: externalId,
        recipientId: response.contacts?.[0]?.wa_id,
        acceptedAt: new Date(),
        raw: response,
      };
    } catch (err) {
      return this.toFailure(err, context, message);
    }
  }

  async markAsRead(context: ProviderContext, externalMessageId: string): Promise<void> {
    const creds = await this.credentials.resolveMetaWhatsApp(context.credentialId);
    await this.client.markAsRead(this.toClientConfig(creds), externalMessageId);
  }

  async setTypingIndicator(
    context: ProviderContext,
    externalMessageId: string,
    state: 'on' | 'off',
  ): Promise<void> {
    const creds = await this.credentials.resolveMetaWhatsApp(context.credentialId);
    await this.client.setTypingIndicator(this.toClientConfig(creds), externalMessageId, state);
  }

  async uploadMedia(
    context: ProviderContext,
    input: MediaUploadInput,
  ): Promise<ProviderMediaUploadResult> {
    const creds = await this.credentials.resolveMetaWhatsApp(context.credentialId);
    const response = await this.client.uploadMedia(this.toClientConfig(creds), {
      buffer: input.buffer,
      mimeType: input.mimeType,
      filename: input.filename,
    });
    return {
      provider: this.type,
      providerMediaId: response.id,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.byteLength,
    };
  }

  async downloadMedia(
    context: ProviderContext,
    providerMediaId: string,
  ): Promise<ProviderMediaDownloadResult> {
    const creds = await this.credentials.resolveMetaWhatsApp(context.credentialId);
    const metadata = await this.client.getMediaMetadata(
      this.toClientConfig(creds),
      providerMediaId,
    );
    const download = await this.client.downloadMediaBinary(
      this.toClientConfig(creds),
      metadata.url,
    );
    const sha256 = createHash('sha256').update(download.buffer).digest('hex');
    return {
      provider: this.type,
      providerMediaId,
      mimeType: metadata.mime_type,
      sizeBytes: metadata.file_size,
      buffer: download.buffer,
      sha256,
    };
  }

  private toClientConfig(creds: MetaWhatsAppCloudCredentials) {
    return {
      accessToken: creds.accessToken,
      phoneNumberId: creds.phoneNumberId,
      businessAccountId: creds.businessAccountId,
      apiVersion: creds.graphApiVersion,
    };
  }

  private toFailure(
    err: unknown,
    context: ProviderContext,
    message: OutboundMessage,
  ): ProviderSendResult {
    if (err instanceof ProviderError) {
      this.logger.warn(
        {
          code: err.code,
          retryable: err.retryable,
          to: message.to,
          tenantId: context.tenantId,
          correlationId: context.correlationId,
        },
        'meta.whatsapp.send.failed',
      );
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
      {
        error: error.message,
        stack: error.stack,
        to: message.to,
        tenantId: context.tenantId,
      },
      'meta.whatsapp.send.unexpected-error',
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

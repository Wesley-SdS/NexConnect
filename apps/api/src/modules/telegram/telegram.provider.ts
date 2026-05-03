import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IMessagingProvider,
  MediaUploadInput,
  OutboundMessage,
  ProviderCapability,
  ProviderChannel,
  ProviderContext,
  ProviderError,
  ProviderHealth,
  ProviderMediaDownloadResult,
  ProviderMediaUploadResult,
  ProviderSendResult,
  ProviderType,
  TelegramCredentials,
} from '@nexconnect/core';
import { ProviderMetricsService } from '@nexconnect/shared';
import { createHash } from 'crypto';
import {
  CREDENTIAL_RESOLVER,
  CredentialResolver,
} from '../providers/credential.resolver';
import { TelegramClient, TelegramClientConfig } from './telegram.client';
import { TelegramMapper } from './telegram.mapper';

const CAPABILITIES: ReadonlySet<ProviderCapability> = new Set([
  ProviderCapability.SEND_TEXT,
  ProviderCapability.SEND_IMAGE,
  ProviderCapability.SEND_VIDEO,
  ProviderCapability.SEND_AUDIO,
  ProviderCapability.SEND_DOCUMENT,
  ProviderCapability.SEND_STICKER,
  ProviderCapability.SEND_LOCATION,
  ProviderCapability.SEND_CONTACTS,
  ProviderCapability.SEND_INTERACTIVE_BUTTONS,
  ProviderCapability.SEND_INTERACTIVE_LIST,
  ProviderCapability.SEND_INTERACTIVE_CARD,
  ProviderCapability.SEND_REPLY,
  ProviderCapability.SEND_POLL,
  ProviderCapability.SEND_DICE,
  ProviderCapability.SEND_REACTION,
  ProviderCapability.EDIT_MESSAGE,
  ProviderCapability.DELETE_MESSAGE,
  ProviderCapability.TYPING_INDICATOR,
  ProviderCapability.UPLOAD_MEDIA,
  ProviderCapability.DOWNLOAD_MEDIA,
  ProviderCapability.SLASH_COMMANDS,
]);

@Injectable()
export class TelegramProvider implements IMessagingProvider {
  readonly type = ProviderType.TELEGRAM;
  readonly channel = ProviderChannel.TELEGRAM;
  readonly capabilities = CAPABILITIES;

  private readonly logger = new Logger(TelegramProvider.name);

  constructor(
    private readonly client: TelegramClient,
    private readonly mapper: TelegramMapper,
    private readonly metrics: ProviderMetricsService,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  supports(capability: ProviderCapability): boolean {
    return this.capabilities.has(capability);
  }

  async send(context: ProviderContext, message: OutboundMessage): Promise<ProviderSendResult> {
    const creds = await this.resolveCreds(context.credentialId);
    const config = this.toConfig(creds);
    const started = Date.now();

    try {
      const chatId = this.toChatId(message.to);
      const call = this.mapper.toSendCall(chatId, message);
      const sent = await this.invokeSend(config, call);
      const durationMs = Date.now() - started;

      this.metrics.recordSend(this.type, 'ok', durationMs, context.tenantId);
      await this.credentials.touch(context.credentialId);

      this.logger.log(
        {
          tenantId: context.tenantId,
          instanceId: context.instanceId,
          messageId: sent.message_id,
          chatId,
          method: call.method,
          durationMs,
        },
        'telegram.message.accepted',
      );

      return {
        ok: true,
        provider: this.type,
        externalMessageId: String(sent.message_id),
        recipientId: String(sent.chat.id),
        acceptedAt: new Date(),
        raw: sent,
      };
    } catch (err) {
      const durationMs = Date.now() - started;
      this.metrics.recordSend(this.type, 'failed', durationMs, context.tenantId);
      return this.toFailure(err);
    }
  }

  async editMessage(
    context: ProviderContext,
    externalMessageId: string,
    message: OutboundMessage,
  ): Promise<ProviderSendResult> {
    const creds = await this.resolveCreds(context.credentialId);
    const config = this.toConfig(creds);

    if (message.type !== 'TEXT' && message.type !== 'BUTTON_REPLY' && message.type !== 'LIST_REPLY') {
      return {
        ok: false,
        provider: this.type,
        code: 'EDIT_TEXT_ONLY',
        message: 'Telegram edit only supports text messages',
        retryable: false,
      };
    }

    try {
      const chatId = this.toChatId(message.to);
      const params = {
        chat_id: chatId,
        message_id: Number(externalMessageId),
        text: 'text' in message ? (message.text ?? '') : ('body' in message ? message.body : ''),
      };
      const result = await this.client.editMessageText(config, params);
      return {
        ok: true,
        provider: this.type,
        externalMessageId,
        acceptedAt: new Date(),
        raw: result,
      };
    } catch (err) {
      return this.toFailure(err);
    }
  }

  async deleteMessage(context: ProviderContext, externalMessageId: string): Promise<void> {
    const creds = await this.resolveCreds(context.credentialId);
    const config = this.toConfig(creds);
    const [chatId, messageId] = externalMessageId.includes(':')
      ? externalMessageId.split(':')
      : [undefined, externalMessageId];
    if (!chatId) {
      throw new ProviderError(
        this.type,
        'AMBIGUOUS_MESSAGE_ID',
        'Telegram deleteMessage requires "chatId:messageId" externalMessageId',
        false,
      );
    }
    await this.client.deleteMessage(config, {
      chat_id: chatId,
      message_id: Number(messageId),
    });
  }

  async addReaction(
    context: ProviderContext,
    externalMessageId: string,
    emoji: string,
  ): Promise<void> {
    const creds = await this.resolveCreds(context.credentialId);
    const [chatId, messageId] = externalMessageId.split(':');
    if (!chatId || !messageId) {
      throw new ProviderError(
        this.type,
        'AMBIGUOUS_MESSAGE_ID',
        'Telegram addReaction requires "chatId:messageId" externalMessageId',
        false,
      );
    }
    await this.client.setMessageReaction(this.toConfig(creds), {
      chat_id: chatId,
      message_id: Number(messageId),
      reaction: [{ type: 'emoji', emoji }],
    });
  }

  async removeReaction(context: ProviderContext, externalMessageId: string): Promise<void> {
    const creds = await this.resolveCreds(context.credentialId);
    const [chatId, messageId] = externalMessageId.split(':');
    await this.client.setMessageReaction(this.toConfig(creds), {
      chat_id: chatId,
      message_id: Number(messageId),
      reaction: [],
    });
  }

  async setTypingIndicator(context: ProviderContext, chatId: string): Promise<void> {
    const creds = await this.resolveCreds(context.credentialId);
    await this.client.sendChatAction(this.toConfig(creds), {
      chat_id: this.toChatId(chatId),
      action: 'typing',
    });
  }

  async uploadMedia(_context: ProviderContext, _input: MediaUploadInput): Promise<ProviderMediaUploadResult> {
    // Telegram does not have a separate media upload endpoint — files are
    // posted multipart on each sendXxx call. We model this by returning a
    // placeholder so the caller falls back to using public URLs in OutboundMessage.
    throw new ProviderError(
      this.type,
      'UPLOAD_NOT_SUPPORTED',
      'Telegram requires media to be sent inline with sendPhoto/sendVideo/etc. Provide a public URL or file_id directly in OutboundMessage.media.',
      false,
    );
  }

  async downloadMedia(
    context: ProviderContext,
    providerMediaId: string,
  ): Promise<ProviderMediaDownloadResult> {
    const creds = await this.resolveCreds(context.credentialId);
    const result = await this.client.downloadFile(this.toConfig(creds), providerMediaId);
    const sha256 = createHash('sha256').update(result.buffer).digest('hex');
    return {
      provider: this.type,
      providerMediaId,
      mimeType: result.mimeType,
      sizeBytes: result.buffer.byteLength,
      buffer: result.buffer,
      sha256,
    };
  }

  async ping(context: ProviderContext): Promise<ProviderHealth> {
    const creds = await this.resolveCreds(context.credentialId);
    const started = Date.now();
    try {
      const me = await this.client.getMe(this.toConfig(creds));
      return { ok: true, latencyMs: Date.now() - started, detail: `@${me.username ?? me.id}` };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - started, detail: (err as Error).message };
    }
  }

  // ─── helpers ─────────────────────────────────────────

  private async resolveCreds(credentialId: string): Promise<TelegramCredentials> {
    const data = await this.credentials.resolve(credentialId);
    if (data.type !== ProviderType.TELEGRAM) {
      throw new ProviderError(
        this.type,
        'CREDENTIAL_TYPE_MISMATCH',
        `Credential ${credentialId} is not a Telegram credential`,
        false,
      );
    }
    return data;
  }

  private toConfig(creds: TelegramCredentials): TelegramClientConfig {
    return { botToken: creds.botToken, apiBaseUrl: creds.apiBaseUrl };
  }

  private toChatId(to: string): number | string {
    const asNumber = Number(to);
    return Number.isFinite(asNumber) ? asNumber : to;
  }

  private async invokeSend(config: TelegramClientConfig, call: ReturnType<TelegramMapper['toSendCall']>) {
    switch (call.method) {
      case 'sendMessage':
        return this.client.sendMessage(config, call.params as never);
      case 'sendPhoto':
        return this.client.sendPhoto(config, call.params as never);
      case 'sendVideo':
        return this.client.sendVideo(config, call.params as never);
      case 'sendAudio':
        return this.client.sendAudio(config, call.params as never);
      case 'sendVoice':
        return this.client.sendVoice(config, call.params as never);
      case 'sendDocument':
        return this.client.sendDocument(config, call.params as never);
      case 'sendSticker':
        return this.client.sendSticker(config, call.params as never);
      case 'sendLocation':
        return this.client.sendLocation(config, call.params as never);
      case 'sendContact':
        return this.client.sendContact(config, call.params as never);
      case 'sendPoll':
        return this.client.sendPoll(config, call.params as never);
      case 'sendDice':
        return this.client.sendDice(config, call.params as never);
      default:
        throw new ProviderError(this.type, 'UNKNOWN_METHOD', `Unknown send method: ${call.method}`, false);
    }
  }

  private toFailure(err: unknown): ProviderSendResult {
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
    this.logger.error({ err: error.message, stack: error.stack }, 'telegram.send.unexpected-error');
    return {
      ok: false,
      provider: this.type,
      code: 'UNEXPECTED_ERROR',
      message: error.message,
      retryable: true,
    };
  }
}

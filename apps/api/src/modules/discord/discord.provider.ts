import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DiscordCredentials,
  IMessagingProvider,
  OutboundMessage,
  ProviderCapability,
  ProviderChannel,
  ProviderContext,
  ProviderError,
  ProviderHealth,
  ProviderSendResult,
  ProviderType,
} from '@nexconnect/core';
import { ProviderMetricsService } from '@nexconnect/shared';
import {
  CREDENTIAL_RESOLVER,
  CredentialResolver,
} from '../providers/credential.resolver';
import { DiscordClient, DiscordClientConfig } from './discord.client';
import { DiscordMapper } from './discord.mapper';

const CAPABILITIES: ReadonlySet<ProviderCapability> = new Set([
  ProviderCapability.SEND_TEXT,
  ProviderCapability.SEND_IMAGE,
  ProviderCapability.SEND_VIDEO,
  ProviderCapability.SEND_AUDIO,
  ProviderCapability.SEND_DOCUMENT,
  ProviderCapability.SEND_STICKER,
  ProviderCapability.SEND_LOCATION,
  ProviderCapability.SEND_INTERACTIVE_BUTTONS,
  ProviderCapability.SEND_INTERACTIVE_LIST,
  ProviderCapability.SEND_INTERACTIVE_CARD,
  ProviderCapability.SEND_REACTION,
  ProviderCapability.SEND_REPLY,
  ProviderCapability.EDIT_MESSAGE,
  ProviderCapability.DELETE_MESSAGE,
  ProviderCapability.TYPING_INDICATOR,
  ProviderCapability.SLASH_COMMANDS,
]);

@Injectable()
export class DiscordProvider implements IMessagingProvider {
  readonly type = ProviderType.DISCORD;
  readonly channel = ProviderChannel.DISCORD;
  readonly capabilities = CAPABILITIES;

  private readonly logger = new Logger(DiscordProvider.name);

  constructor(
    private readonly client: DiscordClient,
    private readonly mapper: DiscordMapper,
    private readonly metrics: ProviderMetricsService,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  supports(capability: ProviderCapability): boolean {
    return this.capabilities.has(capability);
  }

  async send(context: ProviderContext, message: OutboundMessage): Promise<ProviderSendResult> {
    const creds = await this.resolveCreds(context.credentialId);
    const config: DiscordClientConfig = { botToken: creds.botToken };
    const channelId = await this.resolveChannel(config, message.to);

    const started = Date.now();
    try {
      const payload = this.mapper.toCreateMessagePayload(message);
      const sent = await this.client.createMessage(config, channelId, payload);
      const durationMs = Date.now() - started;

      this.metrics.recordSend(this.type, 'ok', durationMs, context.tenantId);
      await this.credentials.touch(context.credentialId);

      this.logger.log(
        {
          tenantId: context.tenantId,
          messageId: sent.id,
          channelId,
          durationMs,
        },
        'discord.message.accepted',
      );

      return {
        ok: true,
        provider: this.type,
        externalMessageId: `${channelId}:${sent.id}`,
        recipientId: channelId,
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
    const [channelId, messageId] = this.splitId(externalMessageId);
    const creds = await this.resolveCreds(context.credentialId);
    try {
      const payload = this.mapper.toCreateMessagePayload(message);
      const sent = await this.client.editMessage(
        { botToken: creds.botToken },
        channelId,
        messageId,
        payload,
      );
      return {
        ok: true,
        provider: this.type,
        externalMessageId: `${channelId}:${sent.id}`,
        recipientId: channelId,
        acceptedAt: new Date(),
        raw: sent,
      };
    } catch (err) {
      return this.toFailure(err);
    }
  }

  async deleteMessage(context: ProviderContext, externalMessageId: string): Promise<void> {
    const [channelId, messageId] = this.splitId(externalMessageId);
    const creds = await this.resolveCreds(context.credentialId);
    await this.client.deleteMessage({ botToken: creds.botToken }, channelId, messageId);
  }

  async addReaction(
    context: ProviderContext,
    externalMessageId: string,
    emoji: string,
  ): Promise<void> {
    const [channelId, messageId] = this.splitId(externalMessageId);
    const creds = await this.resolveCreds(context.credentialId);
    await this.client.createReaction({ botToken: creds.botToken }, channelId, messageId, emoji);
  }

  async removeReaction(
    context: ProviderContext,
    externalMessageId: string,
    emoji: string,
  ): Promise<void> {
    const [channelId, messageId] = this.splitId(externalMessageId);
    const creds = await this.resolveCreds(context.credentialId);
    await this.client.deleteOwnReaction({ botToken: creds.botToken }, channelId, messageId, emoji);
  }

  async setTypingIndicator(context: ProviderContext, channelId: string): Promise<void> {
    const creds = await this.resolveCreds(context.credentialId);
    await this.client.triggerTyping({ botToken: creds.botToken }, channelId);
  }

  async ping(context: ProviderContext): Promise<ProviderHealth> {
    const creds = await this.resolveCreds(context.credentialId);
    const started = Date.now();
    try {
      const me = await this.client.getCurrentBot({ botToken: creds.botToken });
      return { ok: true, latencyMs: Date.now() - started, detail: `${me.username}#${me.discriminator ?? ''}` };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - started, detail: (err as Error).message };
    }
  }

  // ─── helpers ─────────────────────────────────────────

  private async resolveCreds(credentialId: string): Promise<DiscordCredentials> {
    const data = await this.credentials.resolve(credentialId);
    if (data.type !== ProviderType.DISCORD) {
      throw new ProviderError(
        this.type,
        'CREDENTIAL_TYPE_MISMATCH',
        `Credential ${credentialId} is not a Discord credential`,
        false,
      );
    }
    return data;
  }

  /**
   * Discord recipients can be either a channel id (numeric snowflake)
   * or `dm:<userId>` to open a DM channel on demand.
   */
  private async resolveChannel(config: DiscordClientConfig, to: string): Promise<string> {
    if (to.startsWith('dm:')) {
      const userId = to.slice('dm:'.length);
      const dm = await this.client.createDM(config, userId);
      return dm.id;
    }
    return to;
  }

  private splitId(externalMessageId: string): [string, string] {
    const [channelId, messageId] = externalMessageId.split(':');
    if (!channelId || !messageId) {
      throw new ProviderError(
        this.type,
        'AMBIGUOUS_MESSAGE_ID',
        'Discord externalMessageId must be "channelId:messageId"',
        false,
      );
    }
    return [channelId, messageId];
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
    this.logger.error({ err: error.message, stack: error.stack }, 'discord.send.unexpected-error');
    return {
      ok: false,
      provider: this.type,
      code: 'UNEXPECTED_ERROR',
      message: error.message,
      retryable: true,
    };
  }
}

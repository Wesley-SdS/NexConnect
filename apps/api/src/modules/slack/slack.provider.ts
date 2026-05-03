import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IMessagingProvider,
  OutboundMessage,
  ProviderCapability,
  ProviderChannel,
  ProviderContext,
  ProviderError,
  ProviderHealth,
  ProviderSendResult,
  ProviderType,
  SlackCredentials,
} from '@nexconnect/core';
import { ProviderMetricsService } from '@nexconnect/shared';
import {
  CREDENTIAL_RESOLVER,
  CredentialResolver,
} from '../providers/credential.resolver';
import { SlackClient } from './slack.client';
import { SlackMapper } from './slack.mapper';

const CAPABILITIES: ReadonlySet<ProviderCapability> = new Set([
  ProviderCapability.SEND_TEXT,
  ProviderCapability.SEND_IMAGE,
  ProviderCapability.SEND_VIDEO,
  ProviderCapability.SEND_AUDIO,
  ProviderCapability.SEND_DOCUMENT,
  ProviderCapability.SEND_LOCATION,
  ProviderCapability.SEND_INTERACTIVE_BUTTONS,
  ProviderCapability.SEND_INTERACTIVE_LIST,
  ProviderCapability.SEND_INTERACTIVE_CARD,
  ProviderCapability.SEND_REACTION,
  ProviderCapability.SEND_REPLY,
  ProviderCapability.EDIT_MESSAGE,
  ProviderCapability.DELETE_MESSAGE,
  ProviderCapability.SLASH_COMMANDS,
  ProviderCapability.EPHEMERAL_MESSAGE,
  ProviderCapability.SCHEDULED_MESSAGE,
]);

@Injectable()
export class SlackProvider implements IMessagingProvider {
  readonly type = ProviderType.SLACK;
  readonly channel = ProviderChannel.SLACK;
  readonly capabilities = CAPABILITIES;

  private readonly logger = new Logger(SlackProvider.name);

  constructor(
    private readonly client: SlackClient,
    private readonly mapper: SlackMapper,
    private readonly metrics: ProviderMetricsService,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  supports(capability: ProviderCapability): boolean {
    return this.capabilities.has(capability);
  }

  async send(context: ProviderContext, message: OutboundMessage): Promise<ProviderSendResult> {
    const creds = await this.resolveCreds(context.credentialId);
    const config = { botToken: creds.botToken };
    const channel = await this.resolveChannel(config, message.to);
    const started = Date.now();

    try {
      const params = this.mapper.toPostMessageParams(channel, message);
      const sent = await this.client.postMessage(config, params);
      const durationMs = Date.now() - started;

      this.metrics.recordSend(this.type, 'ok', durationMs, context.tenantId);
      await this.credentials.touch(context.credentialId);

      this.logger.log(
        {
          tenantId: context.tenantId,
          channel: sent.channel,
          ts: sent.ts,
          durationMs,
        },
        'slack.message.accepted',
      );

      return {
        ok: true,
        provider: this.type,
        externalMessageId: `${sent.channel ?? channel}:${sent.ts ?? ''}`,
        recipientId: sent.channel ?? channel,
        acceptedAt: new Date(),
        raw: sent,
      };
    } catch (err) {
      this.metrics.recordSend(this.type, 'failed', Date.now() - started, context.tenantId);
      return this.toFailure(err);
    }
  }

  async editMessage(
    context: ProviderContext,
    externalMessageId: string,
    message: OutboundMessage,
  ): Promise<ProviderSendResult> {
    const creds = await this.resolveCreds(context.credentialId);
    const [channel, ts] = this.splitId(externalMessageId);
    try {
      const params = this.mapper.toPostMessageParams(channel, message);
      const updated = await this.client.update(
        { botToken: creds.botToken },
        { channel, ts, text: params.text, blocks: params.blocks },
      );
      return {
        ok: true,
        provider: this.type,
        externalMessageId: `${channel}:${updated.ts ?? ts}`,
        recipientId: channel,
        acceptedAt: new Date(),
        raw: updated,
      };
    } catch (err) {
      return this.toFailure(err);
    }
  }

  async deleteMessage(context: ProviderContext, externalMessageId: string): Promise<void> {
    const creds = await this.resolveCreds(context.credentialId);
    const [channel, ts] = this.splitId(externalMessageId);
    await this.client.deleteMessage({ botToken: creds.botToken }, { channel, ts });
  }

  async addReaction(
    context: ProviderContext,
    externalMessageId: string,
    emoji: string,
  ): Promise<void> {
    const creds = await this.resolveCreds(context.credentialId);
    const [channel, ts] = this.splitId(externalMessageId);
    await this.client.addReaction(
      { botToken: creds.botToken },
      { channel, timestamp: ts, name: emoji.replace(/:/g, '') },
    );
  }

  async removeReaction(
    context: ProviderContext,
    externalMessageId: string,
    emoji: string,
  ): Promise<void> {
    const creds = await this.resolveCreds(context.credentialId);
    const [channel, ts] = this.splitId(externalMessageId);
    await this.client.removeReaction(
      { botToken: creds.botToken },
      { channel, timestamp: ts, name: emoji.replace(/:/g, '') },
    );
  }

  async ping(context: ProviderContext): Promise<ProviderHealth> {
    const creds = await this.resolveCreds(context.credentialId);
    const started = Date.now();
    try {
      const auth = await this.client.authTest({ botToken: creds.botToken });
      return { ok: true, latencyMs: Date.now() - started, detail: `${auth.team}@${auth.url}` };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - started, detail: (err as Error).message };
    }
  }

  // ─── helpers ─────────────────────────────────────────

  private async resolveCreds(credentialId: string): Promise<SlackCredentials> {
    const data = await this.credentials.resolve(credentialId);
    if (data.type !== ProviderType.SLACK) {
      throw new ProviderError(
        this.type,
        'CREDENTIAL_TYPE_MISMATCH',
        `Credential ${credentialId} is not a Slack credential`,
        false,
      );
    }
    return data;
  }

  /**
   * Resolves recipient — channel id (C... / G...), DM channel id (D...),
   * or `user:<userId>` to open a DM via conversations.open.
   */
  private async resolveChannel(config: { botToken: string }, to: string): Promise<string> {
    if (to.startsWith('user:')) {
      const userId = to.slice('user:'.length);
      const dm = await this.client.openConversation(config, userId);
      return dm.channel.id;
    }
    return to;
  }

  private splitId(externalMessageId: string): [string, string] {
    const [channel, ts] = externalMessageId.split(':');
    if (!channel || !ts) {
      throw new ProviderError(
        this.type,
        'AMBIGUOUS_MESSAGE_ID',
        'Slack externalMessageId must be "channel:ts"',
        false,
      );
    }
    return [channel, ts];
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
    this.logger.error({ err: error.message, stack: error.stack }, 'slack.send.unexpected-error');
    return {
      ok: false,
      provider: this.type,
      code: 'UNEXPECTED_ERROR',
      message: error.message,
      retryable: true,
    };
  }
}

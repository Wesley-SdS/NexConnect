import { Injectable, Logger } from '@nestjs/common';
import { HttpClient, ProviderMetricsService } from '@nexconnect/shared';
import { ProviderType } from '@nexconnect/core';
import { SlackErrorMapper } from './slack-error.mapper';
import {
  SlackPostMessageParams,
  SlackPostMessageResponse,
} from './types/slack.types';

export interface SlackClientConfig {
  botToken: string;
  apiBaseUrl?: string;
  timeoutMs?: number;
}

const DEFAULT_BASE = process.env.SLACK_API_BASE_URL ?? 'https://slack.com/api';
const DEFAULT_TIMEOUT = Number(process.env.SLACK_REQUEST_TIMEOUT_MS ?? 30_000);

/**
 * Slack Web API client. Wraps the methods we use directly with
 * NexConnect's shared HttpClient (retry + circuit breaker + metrics).
 * For multipart uploads we still rely on @slack/web-api when needed.
 */
@Injectable()
export class SlackClient {
  private readonly logger = new Logger(SlackClient.name);
  private readonly clients = new Map<string, HttpClient>();

  constructor(private readonly metrics: ProviderMetricsService) {}

  async postMessage(
    config: SlackClientConfig,
    params: SlackPostMessageParams,
  ): Promise<SlackPostMessageResponse> {
    return this.invoke(config, 'chat.postMessage', params as unknown as Record<string, unknown>);
  }

  async postEphemeral(
    config: SlackClientConfig,
    params: SlackPostMessageParams & { user: string },
  ): Promise<SlackPostMessageResponse> {
    return this.invoke(config, 'chat.postEphemeral', params as unknown as Record<string, unknown>);
  }

  async update(
    config: SlackClientConfig,
    params: { channel: string; ts: string; text?: string; blocks?: unknown[] },
  ): Promise<SlackPostMessageResponse> {
    return this.invoke(config, 'chat.update', params as unknown as Record<string, unknown>);
  }

  async deleteMessage(
    config: SlackClientConfig,
    params: { channel: string; ts: string },
  ): Promise<{ ok: true; channel: string; ts: string }> {
    return this.invoke(config, 'chat.delete', params as unknown as Record<string, unknown>);
  }

  async addReaction(
    config: SlackClientConfig,
    params: { channel: string; timestamp: string; name: string },
  ): Promise<{ ok: true }> {
    return this.invoke(config, 'reactions.add', params as unknown as Record<string, unknown>);
  }

  async removeReaction(
    config: SlackClientConfig,
    params: { channel: string; timestamp: string; name: string },
  ): Promise<{ ok: true }> {
    return this.invoke(config, 'reactions.remove', params as unknown as Record<string, unknown>);
  }

  async openConversation(
    config: SlackClientConfig,
    users: string,
  ): Promise<{ ok: true; channel: { id: string } }> {
    return this.invoke(config, 'conversations.open', { users });
  }

  async authTest(config: SlackClientConfig): Promise<{
    ok: true;
    url: string;
    team: string;
    user: string;
    team_id: string;
    user_id: string;
    bot_id?: string;
  }> {
    return this.invoke(config, 'auth.test', {});
  }

  async filesUploadV2(
    config: SlackClientConfig,
    params: { channel_id: string; filename: string; content?: string; file?: Buffer; alt_text?: string },
  ): Promise<{ ok: true; files: Array<{ id: string }> }> {
    return this.invoke(config, 'files.uploadV2', params as unknown as Record<string, unknown>);
  }

  async viewsOpen(
    config: SlackClientConfig,
    params: { trigger_id: string; view: Record<string, unknown> },
  ): Promise<{ ok: true; view: { id: string } }> {
    return this.invoke(config, 'views.open', params as unknown as Record<string, unknown>);
  }

  // ─── private ─────────────────────────────────────────

  private clientFor(config: SlackClientConfig): HttpClient {
    const cacheKey = `${config.botToken}:${config.apiBaseUrl ?? DEFAULT_BASE}`;
    const cached = this.clients.get(cacheKey);
    if (cached) return cached;
    const client = new HttpClient({
      name: 'slack-bot',
      baseUrl: config.apiBaseUrl ?? DEFAULT_BASE,
      defaultHeaders: {
        Authorization: `Bearer ${config.botToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      defaultTimeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT,
      circuitBreaker: { failureThreshold: 10, resetTimeoutMs: 30_000 },
    });
    this.clients.set(cacheKey, client);
    return client;
  }

  private async invoke<T>(
    config: SlackClientConfig,
    method: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const client = this.clientFor(config);
    const started = Date.now();
    const response = await client.post<{ ok: boolean; error?: string }>(method, body);
    const durationMs = Date.now() - started;

    if (!response.ok) {
      this.metrics.recordSend(ProviderType.SLACK, 'failed', durationMs, 'unknown');
      throw SlackErrorMapper.fromHttpStatus(response.status, response.data);
    }
    if (response.data && response.data.ok === false) {
      this.metrics.recordSend(ProviderType.SLACK, 'failed', durationMs, 'unknown');
      throw SlackErrorMapper.fromSlackResponse(response.data);
    }

    this.logger.debug({ method, durationMs }, 'slack.api.invoke');
    return response.data as T;
  }
}

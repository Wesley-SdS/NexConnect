import { Injectable, Logger } from '@nestjs/common';
import { HttpClient, ProviderMetricsService } from '@nexconnect/shared';
import { ProviderType } from '@nexconnect/core';
import { DiscordErrorMapper } from './discord-error.mapper';
import {
  DiscordCreateMessagePayload,
  DiscordMessage,
  DiscordUser,
  Snowflake,
} from './types/discord.types';

export interface DiscordClientConfig {
  botToken: string;
  apiBaseUrl?: string;
  timeoutMs?: number;
}

const DEFAULT_BASE = process.env.DISCORD_API_BASE_URL ?? 'https://discord.com/api/v10';
const DEFAULT_TIMEOUT = Number(process.env.DISCORD_REQUEST_TIMEOUT_MS ?? 30_000);

/**
 * Discord REST API client (Bot token auth). HTTP-only — no Gateway
 * WebSocket; we receive events via the Interactions endpoint.
 */
@Injectable()
export class DiscordClient {
  private readonly logger = new Logger(DiscordClient.name);
  private readonly clients = new Map<string, HttpClient>();

  constructor(private readonly metrics: ProviderMetricsService) {}

  async createMessage(
    config: DiscordClientConfig,
    channelId: Snowflake,
    payload: DiscordCreateMessagePayload,
  ): Promise<DiscordMessage> {
    const started = Date.now();
    const response = await this.client(config).post<DiscordMessage>(
      `channels/${channelId}/messages`,
      payload as unknown as Record<string, unknown>,
    );
    if (!response.ok) {
      this.metrics.recordSend(ProviderType.DISCORD, 'failed', Date.now() - started, 'unknown');
      throw DiscordErrorMapper.from(response.status, response.data);
    }
    this.logger.debug(
      { messageId: response.data.id, channelId, durationMs: response.durationMs },
      'discord.message.created',
    );
    return response.data;
  }

  async editMessage(
    config: DiscordClientConfig,
    channelId: Snowflake,
    messageId: Snowflake,
    payload: DiscordCreateMessagePayload,
  ): Promise<DiscordMessage> {
    const response = await this.client(config).patch<DiscordMessage>(
      `channels/${channelId}/messages/${messageId}`,
      payload as unknown as Record<string, unknown>,
    );
    if (!response.ok) throw DiscordErrorMapper.from(response.status, response.data);
    return response.data;
  }

  async deleteMessage(
    config: DiscordClientConfig,
    channelId: Snowflake,
    messageId: Snowflake,
  ): Promise<void> {
    const response = await this.client(config).delete(`channels/${channelId}/messages/${messageId}`);
    if (!response.ok) throw DiscordErrorMapper.from(response.status, response.data);
  }

  async createReaction(
    config: DiscordClientConfig,
    channelId: Snowflake,
    messageId: Snowflake,
    emoji: string,
  ): Promise<void> {
    const encoded = encodeURIComponent(emoji);
    const response = await this.client(config).put(
      `channels/${channelId}/messages/${messageId}/reactions/${encoded}/@me`,
    );
    if (!response.ok) throw DiscordErrorMapper.from(response.status, response.data);
  }

  async deleteOwnReaction(
    config: DiscordClientConfig,
    channelId: Snowflake,
    messageId: Snowflake,
    emoji: string,
  ): Promise<void> {
    const encoded = encodeURIComponent(emoji);
    const response = await this.client(config).delete(
      `channels/${channelId}/messages/${messageId}/reactions/${encoded}/@me`,
    );
    if (!response.ok) throw DiscordErrorMapper.from(response.status, response.data);
  }

  async triggerTyping(config: DiscordClientConfig, channelId: Snowflake): Promise<void> {
    const response = await this.client(config).post(`channels/${channelId}/typing`, {});
    if (!response.ok) throw DiscordErrorMapper.from(response.status, response.data);
  }

  async createDM(config: DiscordClientConfig, recipientId: Snowflake): Promise<{ id: Snowflake }> {
    const response = await this.client(config).post<{ id: Snowflake }>(`users/@me/channels`, {
      recipient_id: recipientId,
    });
    if (!response.ok) throw DiscordErrorMapper.from(response.status, response.data);
    return response.data;
  }

  async getCurrentBot(config: DiscordClientConfig): Promise<DiscordUser> {
    const response = await this.client(config).get<DiscordUser>('users/@me');
    if (!response.ok) throw DiscordErrorMapper.from(response.status, response.data);
    return response.data;
  }

  async registerGlobalCommand(
    config: DiscordClientConfig,
    applicationId: Snowflake,
    command: { name: string; description: string; type?: number; options?: unknown[] },
  ): Promise<void> {
    const response = await this.client(config).post(
      `applications/${applicationId}/commands`,
      command as unknown as Record<string, unknown>,
    );
    if (!response.ok) throw DiscordErrorMapper.from(response.status, response.data);
  }

  async registerGuildCommand(
    config: DiscordClientConfig,
    applicationId: Snowflake,
    guildId: Snowflake,
    command: { name: string; description: string; type?: number; options?: unknown[] },
  ): Promise<void> {
    const response = await this.client(config).post(
      `applications/${applicationId}/guilds/${guildId}/commands`,
      command as unknown as Record<string, unknown>,
    );
    if (!response.ok) throw DiscordErrorMapper.from(response.status, response.data);
  }

  /**
   * Replies to an interaction via the application interaction-callback URL.
   * No bot auth required: interactions use the per-token URL signed by Discord.
   */
  async replyInteraction(
    interactionId: Snowflake,
    interactionToken: string,
    body: { type: number; data?: unknown },
    apiBaseUrl?: string,
  ): Promise<void> {
    const baseUrl = (apiBaseUrl ?? DEFAULT_BASE).replace(/\/+$/, '');
    const url = `${baseUrl}/interactions/${interactionId}/${interactionToken}/callback`;

    const client = new HttpClient({
      name: 'discord-interaction',
      defaultTimeoutMs: DEFAULT_TIMEOUT,
      defaultHeaders: { 'Content-Type': 'application/json' },
    });
    const response = await client.post(url, body as unknown as Record<string, unknown>);
    if (!response.ok) throw DiscordErrorMapper.from(response.status, response.data);
  }

  // ─── private ─────────────────────────────────────────

  private client(config: DiscordClientConfig): HttpClient {
    const cacheKey = `${config.botToken}:${config.apiBaseUrl ?? DEFAULT_BASE}`;
    const cached = this.clients.get(cacheKey);
    if (cached) return cached;

    const client = new HttpClient({
      name: 'discord-bot',
      baseUrl: config.apiBaseUrl ?? DEFAULT_BASE,
      defaultHeaders: {
        Authorization: `Bot ${config.botToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'NexConnect (https://github.com/nexconnect, 1.0.0)',
      },
      defaultTimeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT,
      circuitBreaker: { failureThreshold: 10, resetTimeoutMs: 30_000 },
    });
    this.clients.set(cacheKey, client);
    return client;
  }
}

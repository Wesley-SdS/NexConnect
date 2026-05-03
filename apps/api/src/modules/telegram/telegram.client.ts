import { Injectable, Logger } from '@nestjs/common';
import { HttpClient, ProviderMetricsService } from '@nexconnect/shared';
import { ProviderType } from '@nexconnect/core';
import { TelegramErrorMapper } from './telegram-error.mapper';
import {
  TelegramApiResponse,
  TelegramFile,
  TelegramMessage,
  TelegramSendMessageParams,
  TelegramSetWebhookParams,
  TelegramUser,
} from './types/telegram.types';

export interface TelegramClientConfig {
  botToken: string;
  apiBaseUrl?: string;
  timeoutMs?: number;
}

const TELEGRAM_TIMEOUT = Number(process.env.TELEGRAM_REQUEST_TIMEOUT_MS ?? 30_000);
const DEFAULT_BASE = process.env.TELEGRAM_API_BASE_URL ?? 'https://api.telegram.org';

/**
 * Low-level HTTP client for Telegram Bot API. Pure transport layer:
 * one method per Bot API endpoint we use. Domain mapping happens in
 * TelegramMapper / TelegramInboundMapper.
 */
@Injectable()
export class TelegramClient {
  private readonly logger = new Logger(TelegramClient.name);
  private readonly clientCache = new Map<string, HttpClient>();

  constructor(private readonly metrics: ProviderMetricsService) {}

  async sendMessage(config: TelegramClientConfig, params: TelegramSendMessageParams): Promise<TelegramMessage> {
    return this.invoke(config, 'sendMessage', params as unknown as Record<string, unknown>);
  }

  async sendPhoto(config: TelegramClientConfig, params: { chat_id: number | string; photo: string; caption?: string; reply_markup?: unknown }): Promise<TelegramMessage> {
    return this.invoke(config, 'sendPhoto', params);
  }

  async sendVideo(config: TelegramClientConfig, params: { chat_id: number | string; video: string; caption?: string }): Promise<TelegramMessage> {
    return this.invoke(config, 'sendVideo', params);
  }

  async sendAudio(config: TelegramClientConfig, params: { chat_id: number | string; audio: string; caption?: string }): Promise<TelegramMessage> {
    return this.invoke(config, 'sendAudio', params);
  }

  async sendVoice(config: TelegramClientConfig, params: { chat_id: number | string; voice: string; caption?: string }): Promise<TelegramMessage> {
    return this.invoke(config, 'sendVoice', params);
  }

  async sendDocument(config: TelegramClientConfig, params: { chat_id: number | string; document: string; caption?: string }): Promise<TelegramMessage> {
    return this.invoke(config, 'sendDocument', params);
  }

  async sendSticker(config: TelegramClientConfig, params: { chat_id: number | string; sticker: string }): Promise<TelegramMessage> {
    return this.invoke(config, 'sendSticker', params);
  }

  async sendLocation(config: TelegramClientConfig, params: { chat_id: number | string; latitude: number; longitude: number }): Promise<TelegramMessage> {
    return this.invoke(config, 'sendLocation', params);
  }

  async sendContact(config: TelegramClientConfig, params: { chat_id: number | string; phone_number: string; first_name: string; last_name?: string; vcard?: string }): Promise<TelegramMessage> {
    return this.invoke(config, 'sendContact', params);
  }

  async sendPoll(config: TelegramClientConfig, params: { chat_id: number | string; question: string; options: string[]; is_anonymous?: boolean; allows_multiple_answers?: boolean; close_date?: number }): Promise<TelegramMessage> {
    return this.invoke(config, 'sendPoll', params);
  }

  async sendDice(config: TelegramClientConfig, params: { chat_id: number | string; emoji?: string }): Promise<TelegramMessage> {
    return this.invoke(config, 'sendDice', params);
  }

  async sendChatAction(config: TelegramClientConfig, params: { chat_id: number | string; action: 'typing' | 'upload_photo' | 'record_video' | 'upload_video' | 'record_voice' | 'upload_voice' | 'upload_document' | 'find_location' }): Promise<boolean> {
    return this.invoke(config, 'sendChatAction', params);
  }

  async editMessageText(config: TelegramClientConfig, params: { chat_id: number | string; message_id: number; text: string; reply_markup?: unknown }): Promise<TelegramMessage | boolean> {
    return this.invoke(config, 'editMessageText', params);
  }

  async deleteMessage(config: TelegramClientConfig, params: { chat_id: number | string; message_id: number }): Promise<boolean> {
    return this.invoke(config, 'deleteMessage', params);
  }

  async answerCallbackQuery(config: TelegramClientConfig, params: { callback_query_id: string; text?: string; show_alert?: boolean }): Promise<boolean> {
    return this.invoke(config, 'answerCallbackQuery', params);
  }

  async setMessageReaction(config: TelegramClientConfig, params: { chat_id: number | string; message_id: number; reaction: Array<{ type: 'emoji'; emoji: string }>; is_big?: boolean }): Promise<boolean> {
    return this.invoke(config, 'setMessageReaction', params);
  }

  async getMe(config: TelegramClientConfig): Promise<TelegramUser> {
    return this.invoke(config, 'getMe', {});
  }

  async getFile(config: TelegramClientConfig, fileId: string): Promise<TelegramFile> {
    return this.invoke(config, 'getFile', { file_id: fileId });
  }

  async setWebhook(config: TelegramClientConfig, params: TelegramSetWebhookParams): Promise<boolean> {
    return this.invoke(config, 'setWebhook', params as unknown as Record<string, unknown>);
  }

  async deleteWebhook(config: TelegramClientConfig, dropPendingUpdates = false): Promise<boolean> {
    return this.invoke(config, 'deleteWebhook', { drop_pending_updates: dropPendingUpdates });
  }

  async getWebhookInfo(config: TelegramClientConfig): Promise<{ url: string; pending_update_count: number; last_error_message?: string }> {
    return this.invoke(config, 'getWebhookInfo', {});
  }

  /**
   * Downloads the actual file bytes after resolving the file_path via getFile.
   * Telegram serves files at https://api.telegram.org/file/bot<token>/<file_path>.
   */
  async downloadFile(config: TelegramClientConfig, fileId: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const file = await this.getFile(config, fileId);
    if (!file.file_path) {
      throw TelegramErrorMapper.from(404, { error_code: 404, description: 'file_path missing' });
    }

    const baseUrl = (config.apiBaseUrl ?? DEFAULT_BASE).replace(/\/+$/, '');
    const url = `${baseUrl}/file/bot${config.botToken}/${file.file_path}`;

    const client = new HttpClient({
      name: 'telegram-file',
      defaultTimeoutMs: config.timeoutMs ?? TELEGRAM_TIMEOUT,
    });
    const response = await client.get<Buffer>(url, { parseJson: false });
    if (!response.ok) {
      throw TelegramErrorMapper.from(response.status, response.data);
    }
    const buffer = response.data instanceof Buffer ? response.data : Buffer.from(response.data as unknown as ArrayBuffer);
    return {
      buffer,
      mimeType: response.headers.get('content-type') ?? 'application/octet-stream',
    };
  }

  // ─── private ─────────────────────────────────────────

  private clientFor(config: TelegramClientConfig): HttpClient {
    const cacheKey = `${config.botToken}:${config.apiBaseUrl ?? DEFAULT_BASE}`;
    const cached = this.clientCache.get(cacheKey);
    if (cached) return cached;

    const baseUrl = `${(config.apiBaseUrl ?? DEFAULT_BASE).replace(/\/+$/, '')}/bot${config.botToken}`;
    const client = new HttpClient({
      name: 'telegram-bot',
      baseUrl,
      defaultHeaders: { 'Content-Type': 'application/json' },
      defaultTimeoutMs: config.timeoutMs ?? TELEGRAM_TIMEOUT,
      circuitBreaker: { failureThreshold: 10, resetTimeoutMs: 30_000 },
    });
    this.clientCache.set(cacheKey, client);
    return client;
  }

  private async invoke<T>(
    config: TelegramClientConfig,
    method: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const client = this.clientFor(config);
    const started = Date.now();
    const response = await client.post<TelegramApiResponse<T>>(method, body);
    const durationMs = Date.now() - started;

    if (!response.ok || !response.data?.ok) {
      this.metrics.recordSend(ProviderType.TELEGRAM, 'failed', durationMs, 'unknown');
      throw TelegramErrorMapper.from(response.status, response.data);
    }

    this.logger.debug({ method, durationMs }, 'telegram.api.invoke');
    return response.data.result as T;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ProviderType } from '@nexconnect/core';
import { HttpClient } from '@nexconnect/shared';
import { MetaErrorMapper } from '../shared/meta-error.mapper';
import { MetaHttpClientFactory } from '../shared/meta-http-client.factory';
import {
  GraphMediaMetadataResponse,
  GraphMediaUploadResponse,
  GraphSendMessageResponse,
  GraphTemplate,
  GraphTemplateListResponse,
} from '../types/graph-api.types';

export interface WhatsAppClientConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  apiVersion?: string;
}

export interface SendMessageInput {
  body: Record<string, unknown>;
}

export interface UploadMediaInput {
  buffer: Buffer;
  mimeType: string;
  filename?: string;
}

export interface CreateTemplateInput {
  name: string;
  language: string;
  category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
  components: GraphTemplate['components'];
}

/**
 * Low-level HTTP client for the WhatsApp Business Cloud API
 * (https://graph.facebook.com/{version}/{...}).
 * Pure transport: never interprets domain semantics — that is the
 * provider/mapper's job.
 */
@Injectable()
export class WhatsAppCloudClient {
  private readonly logger = new Logger(WhatsAppCloudClient.name);

  constructor(private readonly httpFactory: MetaHttpClientFactory) {}

  async sendMessage(
    config: WhatsAppClientConfig,
    input: SendMessageInput,
  ): Promise<GraphSendMessageResponse> {
    const client = this.client(config);
    const response = await client.post<GraphSendMessageResponse>(
      `${config.phoneNumberId}/messages`,
      input.body,
    );

    if (!response.ok) {
      throw MetaErrorMapper.from(
        ProviderType.META_WHATSAPP_CLOUD,
        response.status,
        response.data,
        'Failed to send WhatsApp message',
      );
    }

    this.logger.debug(
      {
        phoneNumberId: config.phoneNumberId,
        messageId: response.data.messages?.[0]?.id,
        durationMs: response.durationMs,
      },
      'meta.whatsapp.message.sent',
    );
    return response.data;
  }

  async markAsRead(config: WhatsAppClientConfig, messageId: string): Promise<void> {
    const client = this.client(config);
    const response = await client.post(`${config.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
    if (!response.ok) {
      throw MetaErrorMapper.from(ProviderType.META_WHATSAPP_CLOUD, response.status, response.data);
    }
  }

  async setTypingIndicator(
    config: WhatsAppClientConfig,
    messageId: string,
    state: 'on' | 'off',
  ): Promise<void> {
    const client = this.client(config);
    const response = await client.post(`${config.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
      typing_indicator: { type: state === 'on' ? 'text' : 'none' },
    });
    if (!response.ok) {
      throw MetaErrorMapper.from(ProviderType.META_WHATSAPP_CLOUD, response.status, response.data);
    }
  }

  async uploadMedia(
    config: WhatsAppClientConfig,
    input: UploadMediaInput,
  ): Promise<GraphMediaUploadResponse> {
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }),
      input.filename ?? 'upload',
    );
    form.append('type', input.mimeType);
    form.append('messaging_product', 'whatsapp');

    const client = this.client(config, { skipJsonContentType: true });
    const response = await client.post<GraphMediaUploadResponse>(
      `${config.phoneNumberId}/media`,
      form,
    );

    if (!response.ok) {
      throw MetaErrorMapper.from(
        ProviderType.META_WHATSAPP_CLOUD,
        response.status,
        response.data,
        'Failed to upload media to WhatsApp Cloud',
      );
    }

    return response.data;
  }

  async getMediaMetadata(
    config: WhatsAppClientConfig,
    mediaId: string,
  ): Promise<GraphMediaMetadataResponse> {
    const client = this.client(config);
    const response = await client.get<GraphMediaMetadataResponse>(mediaId);
    if (!response.ok) {
      throw MetaErrorMapper.from(ProviderType.META_WHATSAPP_CLOUD, response.status, response.data);
    }
    return response.data;
  }

  async downloadMediaBinary(
    config: WhatsAppClientConfig,
    url: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const client = this.client(config);
    const response = await client.get<Buffer>(url, { parseJson: false });
    if (!response.ok) {
      throw MetaErrorMapper.from(ProviderType.META_WHATSAPP_CLOUD, response.status, response.data);
    }
    const buffer =
      response.data instanceof Buffer
        ? response.data
        : Buffer.from(response.data as unknown as ArrayBuffer);
    return {
      buffer,
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    };
  }

  async deleteMedia(config: WhatsAppClientConfig, mediaId: string): Promise<void> {
    const client = this.client(config);
    const response = await client.delete(mediaId);
    if (!response.ok) {
      throw MetaErrorMapper.from(ProviderType.META_WHATSAPP_CLOUD, response.status, response.data);
    }
  }

  async listTemplates(
    config: WhatsAppClientConfig,
    params: { limit?: number; after?: string } = {},
  ): Promise<GraphTemplateListResponse> {
    const client = this.client(config);
    const response = await client.get<GraphTemplateListResponse>(
      `${config.businessAccountId}/message_templates`,
      { query: { limit: params.limit, after: params.after } },
    );
    if (!response.ok) {
      throw MetaErrorMapper.from(ProviderType.META_WHATSAPP_CLOUD, response.status, response.data);
    }
    return response.data;
  }

  async createTemplate(
    config: WhatsAppClientConfig,
    input: CreateTemplateInput,
  ): Promise<{ id: string; status: string; category: string }> {
    const client = this.client(config);
    const response = await client.post<{ id: string; status: string; category: string }>(
      `${config.businessAccountId}/message_templates`,
      input as unknown as Record<string, unknown>,
    );
    if (!response.ok) {
      throw MetaErrorMapper.from(ProviderType.META_WHATSAPP_CLOUD, response.status, response.data);
    }
    return response.data;
  }

  async deleteTemplate(config: WhatsAppClientConfig, templateName: string): Promise<void> {
    const client = this.client(config);
    const response = await client.delete(
      `${config.businessAccountId}/message_templates`,
      { query: { name: templateName } },
    );
    if (!response.ok) {
      throw MetaErrorMapper.from(ProviderType.META_WHATSAPP_CLOUD, response.status, response.data);
    }
  }

  async subscribeToApp(config: WhatsAppClientConfig): Promise<void> {
    const client = this.client(config);
    const response = await client.post(`${config.businessAccountId}/subscribed_apps`, {});
    if (!response.ok) {
      throw MetaErrorMapper.from(ProviderType.META_WHATSAPP_CLOUD, response.status, response.data);
    }
  }

  private client(
    config: WhatsAppClientConfig,
    opts?: { skipJsonContentType?: boolean },
  ): HttpClient {
    const cacheKey = Object.freeze({
      token: config.accessToken,
      phone: config.phoneNumberId,
      version: config.apiVersion ?? 'v21.0',
      skipJson: !!opts?.skipJsonContentType,
    });
    const client = this.httpFactory.create(
      {
        accessToken: config.accessToken,
        apiVersion: config.apiVersion,
      },
      cacheKey,
    );
    return client;
  }
}

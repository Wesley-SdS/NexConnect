import { Injectable, Logger } from '@nestjs/common';
import { ProviderType } from '@nexconnect/core';
import { MetaErrorMapper } from '../shared/meta-error.mapper';
import { MetaHttpClientFactory } from '../shared/meta-http-client.factory';

export interface InstagramClientConfig {
  pageAccessToken: string;
  pageId: string;
  instagramBusinessAccountId: string;
  apiVersion?: string;
}

export interface InstagramSendMessageInput {
  recipientId: string;
  messageText?: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'video' | 'audio' | 'file';
  quickReplies?: Array<{ title: string; payload: string }>;
  messagingType?: 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG';
  tag?: string;
}

export interface InstagramSendMessageResponse {
  recipient_id: string;
  message_id: string;
}

@Injectable()
export class InstagramClient {
  private readonly logger = new Logger(InstagramClient.name);

  constructor(private readonly httpFactory: MetaHttpClientFactory) {}

  async sendMessage(
    config: InstagramClientConfig,
    input: InstagramSendMessageInput,
  ): Promise<InstagramSendMessageResponse> {
    const client = this.httpFactory.create({
      accessToken: config.pageAccessToken,
      apiVersion: config.apiVersion,
    });

    const body: Record<string, unknown> = {
      recipient: { id: input.recipientId },
      messaging_type: input.messagingType ?? 'RESPONSE',
      message: this.buildMessage(input),
    };
    if (input.tag) body.tag = input.tag;

    const response = await client.post<InstagramSendMessageResponse>(
      `${config.pageId}/messages`,
      body,
    );

    if (!response.ok) {
      throw MetaErrorMapper.from(
        ProviderType.META_INSTAGRAM,
        response.status,
        response.data,
        'Failed to send Instagram message',
      );
    }

    this.logger.debug(
      { messageId: response.data.message_id, durationMs: response.durationMs },
      'meta.instagram.message.sent',
    );
    return response.data;
  }

  async markSeen(config: InstagramClientConfig, senderId: string): Promise<void> {
    const client = this.httpFactory.create({
      accessToken: config.pageAccessToken,
      apiVersion: config.apiVersion,
    });
    const response = await client.post(`${config.pageId}/messages`, {
      recipient: { id: senderId },
      sender_action: 'mark_seen',
    });
    if (!response.ok) {
      throw MetaErrorMapper.from(ProviderType.META_INSTAGRAM, response.status, response.data);
    }
  }

  async typingOn(config: InstagramClientConfig, senderId: string, on: boolean): Promise<void> {
    const client = this.httpFactory.create({
      accessToken: config.pageAccessToken,
      apiVersion: config.apiVersion,
    });
    const response = await client.post(`${config.pageId}/messages`, {
      recipient: { id: senderId },
      sender_action: on ? 'typing_on' : 'typing_off',
    });
    if (!response.ok) {
      throw MetaErrorMapper.from(ProviderType.META_INSTAGRAM, response.status, response.data);
    }
  }

  private buildMessage(input: InstagramSendMessageInput): Record<string, unknown> {
    if (input.attachmentUrl && input.attachmentType) {
      return {
        attachment: {
          type: input.attachmentType,
          payload: { url: input.attachmentUrl, is_reusable: true },
        },
      };
    }
    const message: Record<string, unknown> = { text: input.messageText ?? '' };
    if (input.quickReplies && input.quickReplies.length > 0) {
      message.quick_replies = input.quickReplies.map((q) => ({
        content_type: 'text',
        title: q.title,
        payload: q.payload,
      }));
    }
    return message;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { IPipelineStage, MessageContext, MessageType } from '@nexconnect/core';
import { RedisService } from '@nexconnect/redis';

interface BufferState {
  messages: Array<{ text: string; timestamp: number }>;
  lastActivity: number;
}

@Injectable()
export class MessageBufferStage implements IPipelineStage {
  private readonly logger = new Logger(MessageBufferStage.name);

  private static readonly FLUSH_TIMEOUT_MS = 3000;
  private static readonly MAX_BUFFERED_MESSAGES = 10;
  private static readonly FLUSH_PUNCTUATION = /[.!?]$/;
  private static readonly BUFFER_TTL_SECONDS = 30;

  constructor(private readonly redis: RedisService) {}

  async execute(context: MessageContext): Promise<MessageContext | null> {
    if (context.messageType !== MessageType.TEXT) {
      this.logger.debug('Non-text message, bypassing buffer', {
        messageId: context.id,
        messageType: context.messageType,
      });
      return context;
    }

    const senderJid = context.rawMessage.key.remoteJid;
    if (!senderJid) {
      return context;
    }

    const bufferKey = `buffer:${context.instanceId}:${senderJid}`;
    const text = this.extractText(context);

    if (!text) {
      return context;
    }

    const bufferState = await this.loadBuffer(bufferKey);

    bufferState.messages.push({ text, timestamp: Date.now() });
    bufferState.lastActivity = Date.now();

    const shouldFlush = this.shouldFlushBuffer(bufferState, text);

    if (shouldFlush) {
      const combinedText = bufferState.messages
        .map((m) => m.text)
        .join('\n');

      await this.clearBuffer(bufferKey);

      this.logger.debug('Buffer flushed', {
        messageId: context.id,
        bufferedCount: bufferState.messages.length,
        instanceId: context.instanceId,
      });

      return {
        ...context,
        bufferedText: combinedText,
        bufferedMessagesCount: bufferState.messages.length,
      };
    }

    await this.saveBuffer(bufferKey, bufferState);

    this.logger.debug('Message buffered, waiting for more', {
      messageId: context.id,
      currentBufferSize: bufferState.messages.length,
    });

    return null;
  }

  private shouldFlushBuffer(
    state: BufferState,
    latestText: string,
  ): boolean {
    if (state.messages.length >= MessageBufferStage.MAX_BUFFERED_MESSAGES) {
      return true;
    }

    if (MessageBufferStage.FLUSH_PUNCTUATION.test(latestText.trim())) {
      return true;
    }

    if (state.messages.length > 1) {
      const previousTimestamp =
        state.messages[state.messages.length - 2].timestamp;
      const elapsed = Date.now() - previousTimestamp;
      if (elapsed >= MessageBufferStage.FLUSH_TIMEOUT_MS) {
        return true;
      }
    }

    return false;
  }

  private extractText(context: MessageContext): string | null {
    const message = context.rawMessage.message;
    if (!message) {
      return null;
    }

    if (typeof (message as any).conversation === 'string') {
      return (message as any).conversation;
    }

    if ((message as any).extendedTextMessage?.text) {
      return (message as any).extendedTextMessage.text;
    }

    return null;
  }

  private async loadBuffer(key: string): Promise<BufferState> {
    const raw = await this.redis.get(key);
    if (raw) {
      return JSON.parse(raw) as BufferState;
    }
    return { messages: [], lastActivity: Date.now() };
  }

  private async saveBuffer(
    key: string,
    state: BufferState,
  ): Promise<void> {
    await this.redis.set(
      key,
      JSON.stringify(state),
      MessageBufferStage.BUFFER_TTL_SECONDS,
    );
  }

  private async clearBuffer(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

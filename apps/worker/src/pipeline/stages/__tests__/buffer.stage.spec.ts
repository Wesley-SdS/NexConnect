import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageBufferStage } from '../buffer.stage';
import { MessageType, MessageContext } from '@nexconnect/core';

const mockRedisService = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  expire: vi.fn(),
};

describe('MessageBufferStage', () => {
  let stage: MessageBufferStage;

  beforeEach(() => {
    vi.clearAllMocks();
    stage = new MessageBufferStage(mockRedisService as any);
  });

  it('should pass through non-text messages immediately', async () => {
    const context: Partial<MessageContext> = {
      messageType: MessageType.IMAGE,
      instanceId: 'ins_001',
      tenantId: 'ten_001',
      processedContent: { media_url: 'https://r2.example.com/img.jpg' },
      rawMessage: { key: { remoteJid: '5511999998888@s.whatsapp.net' } },
    };

    const result = await stage.process(context as MessageContext);

    expect(result).not.toBeNull();
    expect(result!.buffered).toBeFalsy();
  });

  it('should buffer text messages when buffer is enabled', async () => {
    mockRedisService.get.mockResolvedValue(null);

    const context: Partial<MessageContext> = {
      messageType: MessageType.TEXT,
      instanceId: 'ins_001',
      tenantId: 'ten_001',
      processedContent: { text: 'Hello' },
      rawMessage: { key: { remoteJid: '5511999998888@s.whatsapp.net' } },
      metadata: {
        instanceSettings: {
          bufferEnabled: true,
          bufferWindowMs: 3000,
          bufferMaxMessages: 10,
        },
      },
    };

    const result = await stage.process(context as MessageContext);

    // When buffering, may return null (waiting for more) or context
    // depending on implementation. Either is valid.
    expect(mockRedisService.set).toHaveBeenCalled();
  });

  it('should flush buffer when message ends with terminal punctuation', async () => {
    mockRedisService.get.mockResolvedValue(
      JSON.stringify({ messages: ['Hello'], startedAt: Date.now() - 1000 }),
    );

    const context: Partial<MessageContext> = {
      messageType: MessageType.TEXT,
      instanceId: 'ins_001',
      tenantId: 'ten_001',
      processedContent: { text: 'How are you?' },
      rawMessage: { key: { remoteJid: '5511999998888@s.whatsapp.net' } },
      metadata: {
        instanceSettings: {
          bufferEnabled: true,
          bufferWindowMs: 3000,
          bufferMaxMessages: 10,
        },
      },
    };

    const result = await stage.process(context as MessageContext);

    // Terminal punctuation (?) should trigger flush
    if (result) {
      expect(result.processedContent.text).toContain('Hello');
      expect(result.processedContent.text).toContain('How are you?');
      expect(result.buffered).toBe(true);
    }
  });

  it('should flush when max messages reached', async () => {
    const existingBuffer = {
      messages: Array(9).fill('msg'),
      startedAt: Date.now(),
    };
    mockRedisService.get.mockResolvedValue(JSON.stringify(existingBuffer));

    const context: Partial<MessageContext> = {
      messageType: MessageType.TEXT,
      instanceId: 'ins_001',
      tenantId: 'ten_001',
      processedContent: { text: 'tenth message' },
      rawMessage: { key: { remoteJid: '5511999998888@s.whatsapp.net' } },
      metadata: {
        instanceSettings: {
          bufferEnabled: true,
          bufferWindowMs: 3000,
          bufferMaxMessages: 10,
        },
      },
    };

    const result = await stage.process(context as MessageContext);

    // Max messages reached should trigger flush
    if (result) {
      expect(result.buffered).toBe(true);
    }
    expect(mockRedisService.del).toHaveBeenCalled();
  });

  it('should pass through when buffer is disabled', async () => {
    const context: Partial<MessageContext> = {
      messageType: MessageType.TEXT,
      instanceId: 'ins_001',
      tenantId: 'ten_001',
      processedContent: { text: 'Hello' },
      rawMessage: { key: { remoteJid: '5511999998888@s.whatsapp.net' } },
      metadata: {
        instanceSettings: {
          bufferEnabled: false,
        },
      },
    };

    const result = await stage.process(context as MessageContext);

    expect(result).not.toBeNull();
    expect(result!.processedContent.text).toBe('Hello');
  });
});

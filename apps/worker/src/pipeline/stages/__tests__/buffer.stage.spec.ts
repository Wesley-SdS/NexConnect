import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageContext, MessageType } from '@nexconnect/core';
import { MessageBufferStage } from '../buffer.stage';

const mockRedisService = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
};

const buildContext = (overrides: Partial<MessageContext> = {}): MessageContext =>
  ({
    id: overrides.id ?? 'msg-1',
    instanceId: overrides.instanceId ?? 'ins-1',
    tenantId: overrides.tenantId ?? 'ten-1',
    messageType: overrides.messageType ?? MessageType.TEXT,
    rawMessage: overrides.rawMessage ?? {
      key: { id: 'wamid-1', remoteJid: '5511999999999@s.whatsapp.net' },
      message: { conversation: 'Hello' },
    },
    ...overrides,
  }) as unknown as MessageContext;

describe('MessageBufferStage', () => {
  let stage: MessageBufferStage;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: 1_700_000_000_000 });
    mockRedisService.get.mockResolvedValue(null);
    stage = new MessageBufferStage(mockRedisService as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes non-text messages straight through without buffering', async () => {
    const context = buildContext({
      messageType: MessageType.IMAGE,
      rawMessage: {
        key: { id: 'wamid-img', remoteJid: '5511999@s.whatsapp.net' },
        message: { imageMessage: {} },
      } as never,
    });

    const result = await stage.execute(context);

    expect(result).toBe(context);
    expect(mockRedisService.set).not.toHaveBeenCalled();
  });

  it('flushes pending text buffer when a non-text message arrives', async () => {
    mockRedisService.get.mockResolvedValueOnce(
      JSON.stringify({
        messages: [{ text: 'queued line', timestamp: Date.now() - 100 }],
        lastActivity: Date.now() - 100,
      }),
    );

    const context = buildContext({
      messageType: MessageType.AUDIO,
      rawMessage: {
        key: { id: 'wamid-aud', remoteJid: '5511999@s.whatsapp.net' },
        message: { audioMessage: {} },
      } as never,
    });

    const result = await stage.execute(context);

    expect(result).toBe(context);
    expect(mockRedisService.del).toHaveBeenCalledWith('buffer:ins-1:5511999@s.whatsapp.net');
  });

  it('buffers and returns null while no flush condition is met', async () => {
    const context = buildContext({
      rawMessage: {
        key: { id: 'wamid-1', remoteJid: '5511999@s.whatsapp.net' },
        message: { conversation: 'eai' },
      } as never,
    });

    const result = await stage.execute(context);

    expect(result).toBeNull();
    expect(mockRedisService.set).toHaveBeenCalledWith(
      'buffer:ins-1:5511999@s.whatsapp.net',
      expect.any(String),
      30,
    );
  });

  it('flushes immediately when the latest message ends with terminal punctuation', async () => {
    const context = buildContext({
      rawMessage: {
        key: { id: 'wamid-end', remoteJid: '5511999@s.whatsapp.net' },
        message: { conversation: 'How are you?' },
      } as never,
    });

    const result = await stage.execute(context);

    expect(result).not.toBeNull();
    expect(result).toMatchObject({ bufferedText: 'How are you?' });
    expect(mockRedisService.del).toHaveBeenCalledWith('buffer:ins-1:5511999@s.whatsapp.net');
  });

  it('flushes when the buffer reaches MAX_BUFFERED_MESSAGES', async () => {
    const ninePending = Array.from({ length: 9 }, (_, i) => ({
      text: `line ${i}`,
      timestamp: Date.now() - 1000,
    }));
    mockRedisService.get.mockResolvedValueOnce(
      JSON.stringify({ messages: ninePending, lastActivity: Date.now() - 1000 }),
    );

    const context = buildContext({
      rawMessage: {
        key: { id: 'wamid-10', remoteJid: '5511999@s.whatsapp.net' },
        message: { conversation: 'line 9' },
      } as never,
    });

    const result = await stage.execute(context);

    expect(result).not.toBeNull();
    expect(result).toMatchObject({ bufferedMessagesCount: 10 });
  });

  it('skips buffering when the message has no extractable text', async () => {
    const context = buildContext({
      rawMessage: {
        key: { id: 'wamid-empty', remoteJid: '5511999@s.whatsapp.net' },
        message: {} as never,
      } as never,
    });

    const result = await stage.execute(context);

    expect(result).toBe(context);
    expect(mockRedisService.set).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { MessageClassificationStage } from '../classification.stage';
import { MessageType } from '@nexconnect/core';
import { MessageContext } from '@nexconnect/core';

describe('MessageClassificationStage', () => {
  let stage: MessageClassificationStage;

  beforeEach(() => {
    stage = new MessageClassificationStage();
  });

  it('should classify text messages', async () => {
    const context: Partial<MessageContext> = {
      rawMessage: {
        message: { conversation: 'Hello world' },
        key: { id: 'msg_001' },
      },
      instanceId: 'ins_001',
      tenantId: 'ten_001',
    };

    const result = await stage.process(context as MessageContext);

    expect(result).not.toBeNull();
    expect(result!.messageType).toBe(MessageType.TEXT);
  });

  it('should classify extended text messages', async () => {
    const context: Partial<MessageContext> = {
      rawMessage: {
        message: { extendedTextMessage: { text: 'Hello with link' } },
        key: { id: 'msg_002' },
      },
      instanceId: 'ins_001',
      tenantId: 'ten_001',
    };

    const result = await stage.process(context as MessageContext);

    expect(result).not.toBeNull();
    expect(result!.messageType).toBe(MessageType.TEXT);
  });

  it('should classify image messages', async () => {
    const context: Partial<MessageContext> = {
      rawMessage: {
        message: { imageMessage: { url: 'https://example.com/img.jpg' } },
        key: { id: 'msg_003' },
      },
      instanceId: 'ins_001',
      tenantId: 'ten_001',
    };

    const result = await stage.process(context as MessageContext);

    expect(result).not.toBeNull();
    expect(result!.messageType).toBe(MessageType.IMAGE);
  });

  it('should classify audio messages', async () => {
    const context: Partial<MessageContext> = {
      rawMessage: {
        message: { audioMessage: { url: 'https://example.com/audio.ogg' } },
        key: { id: 'msg_004' },
      },
      instanceId: 'ins_001',
      tenantId: 'ten_001',
    };

    const result = await stage.process(context as MessageContext);

    expect(result).not.toBeNull();
    expect(result!.messageType).toBe(MessageType.AUDIO);
  });

  it('should classify video messages', async () => {
    const context: Partial<MessageContext> = {
      rawMessage: {
        message: { videoMessage: { url: 'https://example.com/video.mp4' } },
        key: { id: 'msg_005' },
      },
      instanceId: 'ins_001',
      tenantId: 'ten_001',
    };

    const result = await stage.process(context as MessageContext);

    expect(result).not.toBeNull();
    expect(result!.messageType).toBe(MessageType.VIDEO);
  });

  it('should classify document messages', async () => {
    const context: Partial<MessageContext> = {
      rawMessage: {
        message: { documentMessage: { url: 'https://example.com/doc.pdf' } },
        key: { id: 'msg_006' },
      },
      instanceId: 'ins_001',
      tenantId: 'ten_001',
    };

    const result = await stage.process(context as MessageContext);

    expect(result).not.toBeNull();
    expect(result!.messageType).toBe(MessageType.DOCUMENT);
  });

  it('should classify sticker messages', async () => {
    const context: Partial<MessageContext> = {
      rawMessage: {
        message: { stickerMessage: { url: 'https://example.com/sticker.webp' } },
        key: { id: 'msg_007' },
      },
      instanceId: 'ins_001',
      tenantId: 'ten_001',
    };

    const result = await stage.process(context as MessageContext);

    expect(result).not.toBeNull();
    expect(result!.messageType).toBe(MessageType.STICKER);
  });

  it('should classify location messages', async () => {
    const context: Partial<MessageContext> = {
      rawMessage: {
        message: { locationMessage: { degreesLatitude: -23.5, degreesLongitude: -46.6 } },
        key: { id: 'msg_008' },
      },
      instanceId: 'ins_001',
      tenantId: 'ten_001',
    };

    const result = await stage.process(context as MessageContext);

    expect(result).not.toBeNull();
    expect(result!.messageType).toBe(MessageType.LOCATION);
  });

  it('should classify contact/vcard messages', async () => {
    const context: Partial<MessageContext> = {
      rawMessage: {
        message: { contactMessage: { displayName: 'John', vcard: 'BEGIN:VCARD...' } },
        key: { id: 'msg_009' },
      },
      instanceId: 'ins_001',
      tenantId: 'ten_001',
    };

    const result = await stage.process(context as MessageContext);

    expect(result).not.toBeNull();
    expect(result!.messageType).toBe(MessageType.VCARD);
  });

  it('should classify reaction messages', async () => {
    const context: Partial<MessageContext> = {
      rawMessage: {
        message: { reactionMessage: { text: '👍', key: { id: 'orig_msg' } } },
        key: { id: 'msg_010' },
      },
      instanceId: 'ins_001',
      tenantId: 'ten_001',
    };

    const result = await stage.process(context as MessageContext);

    expect(result).not.toBeNull();
    expect(result!.messageType).toBe(MessageType.REACTION);
  });
});

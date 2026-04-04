import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageEnrichmentStage } from '../enrichment.stage';
import { MessageContext, MessageType } from '@nexconnect/core';

const mockPrismaService = {
  instance: {
    findUnique: vi.fn(),
  },
};

describe('MessageEnrichmentStage', () => {
  let stage: MessageEnrichmentStage;

  beforeEach(() => {
    vi.clearAllMocks();
    stage = new MessageEnrichmentStage(mockPrismaService as any);
  });

  it('should enrich context with tenant and contact info', async () => {
    mockPrismaService.instance.findUnique.mockResolvedValue({
      id: 'ins_001',
      tenantId: 'ten_001',
      phoneNumber: '+5511999990000',
    });

    const context: Partial<MessageContext> = {
      instanceId: 'ins_001',
      tenantId: 'ten_001',
      messageType: MessageType.TEXT,
      processedContent: { text: 'Hello' },
      rawMessage: {
        key: {
          remoteJid: '5511999998888@s.whatsapp.net',
          fromMe: false,
        },
        pushName: 'João Silva',
      },
    };

    const result = await stage.process(context as MessageContext);

    expect(result).not.toBeNull();
    expect(result!.metadata.fromName).toBe('João Silva');
    expect(result!.metadata.fromPhone).toBe('+5511999998888');
    expect(result!.metadata.isGroup).toBe(false);
  });

  it('should detect group messages', async () => {
    const context: Partial<MessageContext> = {
      instanceId: 'ins_001',
      tenantId: 'ten_001',
      messageType: MessageType.TEXT,
      processedContent: { text: 'Hello group' },
      rawMessage: {
        key: {
          remoteJid: '120363001234567890@g.us',
          fromMe: false,
          participant: '5511999998888@s.whatsapp.net',
        },
        pushName: 'Maria',
      },
    };

    const result = await stage.process(context as MessageContext);

    expect(result).not.toBeNull();
    expect(result!.metadata.isGroup).toBe(true);
    expect(result!.metadata.groupJid).toBe('120363001234567890@g.us');
  });

  it('should normalize phone number', async () => {
    const context: Partial<MessageContext> = {
      instanceId: 'ins_001',
      tenantId: 'ten_001',
      messageType: MessageType.TEXT,
      processedContent: { text: 'test' },
      rawMessage: {
        key: {
          remoteJid: '5511999998888@s.whatsapp.net',
          fromMe: false,
        },
        pushName: 'Test User',
      },
    };

    const result = await stage.process(context as MessageContext);

    expect(result!.metadata.fromPhone).toBe('+5511999998888');
  });
});

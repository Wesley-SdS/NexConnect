import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessagePipelineService } from '../message-pipeline.service';
import { MessageContext, MessageType } from '@nexconnect/core';

const createMockStage = (name: string, shouldPass = true) => ({
  process: vi.fn().mockImplementation(async (ctx: MessageContext) => {
    return shouldPass ? ctx : null;
  }),
  stageName: name,
});

describe('MessagePipelineService', () => {
  let pipeline: MessagePipelineService;
  let stages: ReturnType<typeof createMockStage>[];

  beforeEach(() => {
    stages = [
      createMockStage('deduplication'),
      createMockStage('classification'),
      createMockStage('buffer'),
      createMockStage('mediaProcessing'),
      createMockStage('enrichment'),
      createMockStage('presence'),
      createMockStage('forward'),
    ];

    pipeline = new MessagePipelineService(
      stages[0] as any,
      stages[1] as any,
      stages[2] as any,
      stages[3] as any,
      stages[4] as any,
      stages[5] as any,
      stages[6] as any,
    );
  });

  it('should execute all stages in order', async () => {
    const context: Partial<MessageContext> = {
      rawMessage: { key: { id: 'msg_001' } },
      instanceId: 'ins_001',
      tenantId: 'ten_001',
    };

    await pipeline.process(context as MessageContext);

    for (const stage of stages) {
      expect(stage.process).toHaveBeenCalled();
    }

    // Verify order
    const callOrder = stages.map((s) => s.process.mock.invocationCallOrder[0]);
    for (let i = 1; i < callOrder.length; i++) {
      expect(callOrder[i]).toBeGreaterThan(callOrder[i - 1]);
    }
  });

  it('should stop pipeline when a stage returns null', async () => {
    stages[0] = createMockStage('deduplication', false); // dedup rejects

    pipeline = new MessagePipelineService(
      stages[0] as any,
      stages[1] as any,
      stages[2] as any,
      stages[3] as any,
      stages[4] as any,
      stages[5] as any,
      stages[6] as any,
    );

    const context: Partial<MessageContext> = {
      rawMessage: { key: { id: 'dup_msg' } },
      instanceId: 'ins_001',
      tenantId: 'ten_001',
    };

    const result = await pipeline.process(context as MessageContext);

    expect(result).toBeNull();
    expect(stages[0].process).toHaveBeenCalled();
    expect(stages[1].process).not.toHaveBeenCalled();
  });

  it('should pass context from one stage to the next', async () => {
    stages[1].process.mockImplementation(async (ctx: MessageContext) => ({
      ...ctx,
      messageType: MessageType.TEXT,
    }));

    const context: Partial<MessageContext> = {
      rawMessage: { key: { id: 'msg_002' } },
      instanceId: 'ins_001',
      tenantId: 'ten_001',
    };

    await pipeline.process(context as MessageContext);

    const enrichmentCall = stages[4].process.mock.calls[0][0];
    expect(enrichmentCall.messageType).toBe(MessageType.TEXT);
  });
});

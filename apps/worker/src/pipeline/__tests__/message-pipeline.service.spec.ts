import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageContext } from '@nexconnect/core';
import { MessagePipelineService } from '../message-pipeline.service';

const stageNames = [
  'MessageDeduplicationStage',
  'MessageClassificationStage',
  'MessageBufferStage',
  'MediaProcessingStage',
  'MessageEnrichmentStage',
  'PresenceUpdateStage',
  'WebhookForwardStage',
] as const;

function makeStage(name: string, behavior: 'pass' | 'halt' | 'throw' = 'pass') {
  const fn = vi.fn(async (ctx: MessageContext) => {
    if (behavior === 'halt') return null;
    if (behavior === 'throw') throw new Error(`${name} exploded`);
    return ctx;
  });
  return Object.defineProperty({ execute: fn }, 'constructor', {
    value: { name },
  }) as never;
}

const buildContext = (): MessageContext =>
  ({ id: 'msg-1', instanceId: 'ins-1', tenantId: 'ten-1' }) as unknown as MessageContext;

describe('MessagePipelineService', () => {
  let stages: ReturnType<typeof makeStage>[];

  beforeEach(() => {
    stages = stageNames.map((n) => makeStage(n));
  });

  it('runs every stage in order and returns the final context', async () => {
    const service = new MessagePipelineService(...(stages as never[]));
    const context = buildContext();

    const result = await service.process(context);

    expect(result).toBe(context);
    for (const stage of stages) {
      expect(stage.execute).toHaveBeenCalledWith(context);
    }
  });

  it('halts the pipeline as soon as a stage returns null', async () => {
    const halting = makeStage('MessageBufferStage', 'halt');
    const service = new MessagePipelineService(
      stages[0],
      stages[1],
      halting,
      stages[3],
      stages[4],
      stages[5],
      stages[6],
    );

    const result = await service.process(buildContext());

    expect(result).toBeNull();
    expect(stages[3].execute).not.toHaveBeenCalled();
    expect(stages[6].execute).not.toHaveBeenCalled();
  });

  it('rethrows when a stage throws', async () => {
    const failing = makeStage('MediaProcessingStage', 'throw');
    const service = new MessagePipelineService(
      stages[0],
      stages[1],
      stages[2],
      failing,
      stages[4],
      stages[5],
      stages[6],
    );

    await expect(service.process(buildContext())).rejects.toThrow('exploded');
    expect(stages[6].execute).not.toHaveBeenCalled();
  });
});

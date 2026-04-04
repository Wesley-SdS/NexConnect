import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationStage } from '../validation.stage';
import { NexConnectException } from '@nexconnect/shared';
import type { OutboundMessage } from '../outbound-pipeline-stage.interface';

describe('ValidationStage', () => {
  let stage: ValidationStage;

  const validMessage: OutboundMessage = {
    messageId: 'msg-001',
    instanceId: 'ins-001',
    tenantId: 'ten-001',
    to: '+5511999998888',
    type: 'text',
    content: { text: 'Hello!' },
  };

  beforeEach(() => {
    stage = new ValidationStage();
  });

  it('should pass when all required fields are present', async () => {
    await expect(stage.execute(validMessage)).resolves.toBeUndefined();
  });

  it('should throw when "to" is missing', async () => {
    const message = { ...validMessage, to: '' };

    await expect(stage.execute(message)).rejects.toThrow(NexConnectException);
    await expect(stage.execute(message)).rejects.toThrow('missing required fields');
  });

  it('should throw when "type" is missing', async () => {
    const message = { ...validMessage, type: '' };

    await expect(stage.execute(message)).rejects.toThrow(NexConnectException);
  });

  it('should throw when "content" is missing', async () => {
    const message = { ...validMessage, content: null as any };

    await expect(stage.execute(message)).rejects.toThrow(NexConnectException);
  });

  it('should throw when "to" is undefined', async () => {
    const message = { ...validMessage, to: undefined as any };

    await expect(stage.execute(message)).rejects.toThrow(NexConnectException);
  });
});

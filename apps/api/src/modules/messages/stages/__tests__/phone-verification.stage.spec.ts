import { describe, it, expect, beforeEach } from 'vitest';
import { PhoneVerificationStage } from '../phone-verification.stage';
import { InvalidPhoneNumberException } from '@nexconnect/shared';
import type { OutboundMessage } from '../outbound-pipeline-stage.interface';

describe('PhoneVerificationStage', () => {
  let stage: PhoneVerificationStage;

  const createMessage = (to: string): OutboundMessage => ({
    messageId: 'msg-001',
    instanceId: 'ins-001',
    tenantId: 'ten-001',
    to,
    type: 'text',
    content: { text: 'Hello!' },
  });

  beforeEach(() => {
    stage = new PhoneVerificationStage();
  });

  it('should pass with a valid international phone number', async () => {
    const message = createMessage('+5511999998888');

    await expect(stage.execute(message)).resolves.toBeUndefined();
  });

  it('should pass with a valid phone number without + prefix', async () => {
    const message = createMessage('5511999998888');

    await expect(stage.execute(message)).resolves.toBeUndefined();
  });

  it('should throw InvalidPhoneNumberException for too short number', async () => {
    const message = createMessage('123');

    await expect(stage.execute(message)).rejects.toThrow(
      InvalidPhoneNumberException,
    );
  });

  it('should throw InvalidPhoneNumberException for non-numeric input', async () => {
    const message = createMessage('not-a-phone');

    await expect(stage.execute(message)).rejects.toThrow(
      InvalidPhoneNumberException,
    );
  });

  it('should throw InvalidPhoneNumberException for empty string', async () => {
    const message = createMessage('');

    await expect(stage.execute(message)).rejects.toThrow(
      InvalidPhoneNumberException,
    );
  });

  it('should include the invalid phone number in the error message', async () => {
    const badPhone = 'abc';
    const message = createMessage(badPhone);

    await expect(stage.execute(message)).rejects.toThrow(badPhone);
  });
});

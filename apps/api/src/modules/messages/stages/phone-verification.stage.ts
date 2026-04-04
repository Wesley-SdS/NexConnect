import { Injectable } from '@nestjs/common';
import { PhoneUtil, InvalidPhoneNumberException } from '@nexconnect/shared';
import {
  IOutboundPipelineStage,
  OutboundMessage,
} from './outbound-pipeline-stage.interface';

@Injectable()
export class PhoneVerificationStage implements IOutboundPipelineStage {
  async execute(message: OutboundMessage): Promise<void> {
    const normalized = PhoneUtil.normalize(message.to);

    if (!PhoneUtil.isValid(normalized)) {
      throw new InvalidPhoneNumberException(message.to);
    }
  }
}

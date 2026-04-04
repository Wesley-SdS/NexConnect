import { Injectable, HttpStatus } from '@nestjs/common';
import { NexConnectException } from '@nexconnect/shared';
import {
  IOutboundPipelineStage,
  OutboundMessage,
} from './outbound-pipeline-stage.interface';

@Injectable()
export class ValidationStage implements IOutboundPipelineStage {
  async execute(message: OutboundMessage): Promise<void> {
    if (!message.to || !message.type || !message.content) {
      throw new NexConnectException(
        'Invalid message: missing required fields',
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
      );
    }
  }
}

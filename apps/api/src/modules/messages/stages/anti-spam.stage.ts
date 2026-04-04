import { Injectable } from '@nestjs/common';
import { RedisService } from '@nexconnect/redis';
import { RateLimitExceededException } from '@nexconnect/shared';
import {
  IOutboundPipelineStage,
  OutboundMessage,
} from './outbound-pipeline-stage.interface';

const ANTI_SPAM_LIMIT_PER_MINUTE = 30;
const ANTI_SPAM_WINDOW_SECONDS = 60;

@Injectable()
export class AntiSpamStage implements IOutboundPipelineStage {
  constructor(private readonly redis: RedisService) {}

  async execute(message: OutboundMessage): Promise<void> {
    const key = `antispam:${message.instanceId}:${message.to}`;
    const count = await this.redis.incrWithTtl(key, ANTI_SPAM_WINDOW_SECONDS);

    if (count > ANTI_SPAM_LIMIT_PER_MINUTE) {
      throw new RateLimitExceededException(
        `Rate limit exceeded for ${message.to}: ${count}/${ANTI_SPAM_LIMIT_PER_MINUTE} per minute`,
      );
    }
  }
}

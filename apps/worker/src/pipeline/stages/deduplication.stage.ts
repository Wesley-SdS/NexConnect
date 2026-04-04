import { Injectable, Logger } from '@nestjs/common';
import { IPipelineStage, MessageContext } from '@nexconnect/core';
import { RedisService } from '@nexconnect/redis';
import { DEDUP_TTL_SECONDS } from '@nexconnect/shared';

@Injectable()
export class MessageDeduplicationStage implements IPipelineStage {
  private readonly logger = new Logger(MessageDeduplicationStage.name);

  constructor(private readonly redis: RedisService) {}

  async execute(context: MessageContext): Promise<MessageContext | null> {
    const dedupKey = `dedup:msg:${context.instanceId}:${context.rawMessage.key.id}`;

    const exists = await this.redis.get(dedupKey);

    if (exists) {
      this.logger.debug('Duplicate message detected, skipping', {
        messageId: context.id,
        baileysMessageId: context.rawMessage.key.id,
        instanceId: context.instanceId,
      });
      return null;
    }

    await this.redis.set(dedupKey, '1', DEDUP_TTL_SECONDS);

    this.logger.debug('Message is unique, proceeding', {
      messageId: context.id,
      instanceId: context.instanceId,
    });

    return context;
  }
}

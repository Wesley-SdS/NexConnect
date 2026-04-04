import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@nexconnect/database';
import { RedisService } from '@nexconnect/redis';
import { PhoneUtil } from '@nexconnect/shared';

interface OutboundMessage {
  messageId: string;
  instanceId: string;
  tenantId: string;
  to: string;
  type: string;
  content: Record<string, any>;
}

enum PipelineStage {
  VALIDATION = 'validation',
  PHONE_VERIFICATION = 'phone_verification',
  ANTI_SPAM = 'anti_spam',
  MEDIA_PREP = 'media_prep',
  DELIVERY = 'delivery',
  TRACKING = 'tracking',
}

@Injectable()
export class OutboundPipelineService {
  private readonly logger = new Logger(OutboundPipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async process(message: OutboundMessage): Promise<void> {
    try {
      await this.updateStatus(message.messageId, 'processing');

      await this.validate(message);
      await this.verifyPhone(message);
      await this.checkAntiSpam(message);
      await this.prepareMedia(message);
      await this.markReady(message);
    } catch (error) {
      this.logger.error(
        { messageId: message.messageId, err: error },
        'Pipeline failed',
      );
      await this.updateStatus(message.messageId, 'failed');
      throw error;
    }
  }

  private async validate(message: OutboundMessage): Promise<void> {
    if (!message.to || !message.type || !message.content) {
      throw new Error('Invalid message: missing required fields');
    }
  }

  private async verifyPhone(message: OutboundMessage): Promise<void> {
    const normalized = PhoneUtil.normalize(message.to);

    if (!PhoneUtil.isValid(normalized)) {
      throw new Error(`Invalid phone number: ${message.to}`);
    }
  }

  private async checkAntiSpam(message: OutboundMessage): Promise<void> {
    const key = `antispam:${message.instanceId}:${message.to}`;
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, 60);
    }

    const limit = 30;
    if (count > limit) {
      throw new Error(`Rate limit exceeded for ${message.to}: ${count}/${limit} per minute`);
    }
  }

  private async prepareMedia(message: OutboundMessage): Promise<void> {
    const mediaTypes = ['image', 'video', 'audio', 'document', 'sticker'];

    if (!mediaTypes.includes(message.type)) {
      return;
    }

    this.logger.log(
      { messageId: message.messageId, type: message.type },
      'Media preparation stage',
    );
  }

  private async markReady(message: OutboundMessage): Promise<void> {
    await this.updateStatus(message.messageId, 'ready');
  }

  private async updateStatus(messageId: string, status: string): Promise<void> {
    await this.prisma.message.update({
      where: { id: messageId },
      data: { status },
    });
  }
}

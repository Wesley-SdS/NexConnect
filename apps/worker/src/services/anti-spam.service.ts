import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@nexconnect/database';
import { RedisService } from '@nexconnect/redis';
import { Prisma } from '@prisma/client';
import { MessageDirection } from '@nexconnect/core';

@Injectable()
export class AntiSpamService {
  private readonly logger = new Logger(AntiSpamService.name);

  private static readonly COOLDOWN_TTL_SECONDS = 60;
  private static readonly SPAM_THRESHOLD = 0.7;
  private static readonly AUTO_BLACKLIST_FAIL_COUNT = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async checkBlacklist(instanceId: string, phone: string): Promise<boolean> {
    const cacheKey = `blacklist:${instanceId}:${phone}`;
    const cached = await this.redis.get(cacheKey);

    if (cached !== null) {
      return cached === '1';
    }

    const entry = await this.prisma.blacklist.findFirst({
      where: { instanceId, phone },
    });

    const blocked = !!entry;
    await this.redis.set(cacheKey, blocked ? '1' : '0', 3_600);

    if (blocked) {
      this.logger.debug('Phone is blacklisted', { instanceId, phone });
    }

    return blocked;
  }

  async checkCooldown(instanceId: string, phone: string): Promise<boolean> {
    const cooldownKey = `cooldown:${instanceId}:${phone}`;
    const exists = await this.redis.exists(cooldownKey);

    if (exists) {
      this.logger.debug('Phone is in cooldown period', { instanceId, phone });
      return true;
    }

    return false;
  }

  async setCooldown(instanceId: string, phone: string): Promise<void> {
    const cooldownKey = `cooldown:${instanceId}:${phone}`;
    await this.redis.set(
      cooldownKey,
      '1',
      AntiSpamService.COOLDOWN_TTL_SECONDS,
    );
  }

  async detectSpamPattern(instanceId: string): Promise<boolean> {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const [totalSent, recipientsWhoReplied] = await Promise.all([
      this.prisma.message.count({
        where: {
          instanceId,
          direction: MessageDirection.OUTBOUND,
          createdAt: { gte: since },
        },
      }),
      this.prisma.$queryRaw<Array<{ wa_message_id: string }>>`
        SELECT DISTINCT wa_message_id FROM messages
        WHERE instance_id = ${instanceId}
          AND direction = 'INBOUND'
          AND created_at >= ${since}
      `,
    ]);

    if (totalSent === 0) {
      return false;
    }

    const uniqueOutbound = await this.prisma.$queryRaw<Array<{ wa_message_id: string }>>`
      SELECT DISTINCT wa_message_id FROM messages
      WHERE instance_id = ${instanceId}
        AND direction = 'OUTBOUND'
        AND created_at >= ${since}
    `;

    const totalRecipients = uniqueOutbound.length;

    if (totalRecipients === 0) {
      return false;
    }

    const noReplyRate =
      1 - recipientsWhoReplied.length / totalRecipients;

    const isSpammy = noReplyRate > AntiSpamService.SPAM_THRESHOLD;

    if (isSpammy) {
      this.logger.warn('Spam pattern detected: high no-reply rate', {
        instanceId,
        totalRecipients,
        repliedCount: recipientsWhoReplied.length,
        noReplyRate: `${(noReplyRate * 100).toFixed(1)}%`,
      });
    }

    return isSpammy;
  }

  async autoBlacklist(
    instanceId: string,
    phone: string,
    failCount: number,
  ): Promise<boolean> {
    if (failCount < AntiSpamService.AUTO_BLACKLIST_FAIL_COUNT) {
      return false;
    }

    await this.prisma.blacklist.upsert({
      where: {
        instanceId_phone: { instanceId, phone },
      },
      create: {
        instanceId,
        phone,
        reason: `Auto-blacklisted after ${failCount} consecutive failures`,
      },
      update: {
        reason: `Auto-blacklisted after ${failCount} consecutive failures`,
      },
    });

    const cacheKey = `blacklist:${instanceId}:${phone}`;
    await this.redis.set(cacheKey, '1', 3_600);

    this.logger.warn('Phone auto-blacklisted', {
      instanceId,
      phone,
      failCount,
    });

    return true;
  }

  checkSendWindow(instanceSettings: {
    sendWindow?: {
      enabled: boolean;
      startHour: number;
      endHour: number;
      timezone: string;
    };
  }): boolean {
    const window = instanceSettings?.sendWindow;

    if (!window || !window.enabled) {
      return true;
    }

    const now = new Date();

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: window.timezone,
      hour: 'numeric',
      hour12: false,
    });

    const currentHour = parseInt(formatter.format(now), 10);

    const withinWindow =
      currentHour >= window.startHour && currentHour < window.endHour;

    if (!withinWindow) {
      this.logger.debug('Outside send window', {
        currentHour,
        startHour: window.startHour,
        endHour: window.endHour,
        timezone: window.timezone,
      });
    }

    return withinWindow;
  }
}

import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@nexconnect/database';
import { RedisService } from '@nexconnect/redis';
import { InstancesService } from './instances.service';

interface AddBlacklistDto {
  phone: string;
  reason: string;
}

interface AddWhitelistDto {
  phone: string;
}

const BLACKLIST_CACHE_TTL = 3600; // 1h

@Injectable()
export class BlacklistService {
  private readonly logger = new Logger(BlacklistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly instancesService: InstancesService,
  ) {}

  // ─── Blacklist ────────────────────────────────────────

  async getBlacklist(tenantId: string, instanceId: string) {
    await this.instancesService.findOne(tenantId, instanceId);

    const entries = await this.prisma.blacklist.findMany({
      where: { instanceId },
      orderBy: { createdAt: 'desc' },
    });

    return { blacklist: entries };
  }

  async addToBlacklist(
    tenantId: string,
    instanceId: string,
    dto: AddBlacklistDto,
  ) {
    await this.instancesService.findOne(tenantId, instanceId);

    const existing = await this.prisma.blacklist.findUnique({
      where: { instanceId_phone: { instanceId, phone: dto.phone } },
    });

    if (existing) {
      throw new ConflictException(
        `Phone ${dto.phone} is already blacklisted`,
      );
    }

    const entry = await this.prisma.blacklist.create({
      data: {
        instanceId,
        phone: dto.phone,
        reason: dto.reason,
      },
    });

    await this.syncBlacklistCache(instanceId);

    this.logger.log(
      { instanceId, phone: dto.phone },
      'Phone added to blacklist',
    );

    return entry;
  }

  async removeFromBlacklist(
    tenantId: string,
    instanceId: string,
    phone: string,
  ) {
    await this.instancesService.findOne(tenantId, instanceId);

    const entry = await this.prisma.blacklist.findUnique({
      where: { instanceId_phone: { instanceId, phone } },
    });

    if (!entry) {
      throw new NotFoundException(
        `Phone ${phone} not found in blacklist`,
      );
    }

    await this.prisma.blacklist.delete({
      where: { id: entry.id },
    });

    await this.syncBlacklistCache(instanceId);

    this.logger.log(
      { instanceId, phone },
      'Phone removed from blacklist',
    );

    return { message: 'Phone removed from blacklist' };
  }

  async isBlacklisted(instanceId: string, phone: string): Promise<boolean> {
    const cacheKey = `blacklist:${instanceId}`;
    const cached = await this.redis.hget(cacheKey, phone);

    if (cached !== null) {
      return cached === '1';
    }

    const entry = await this.prisma.blacklist.findUnique({
      where: { instanceId_phone: { instanceId, phone } },
    });

    const isBlocked = !!entry;
    await this.redis.hset(cacheKey, phone, isBlocked ? '1' : '0');
    await this.redis.expire(cacheKey, BLACKLIST_CACHE_TTL);

    return isBlocked;
  }

  async incrementFailCount(instanceId: string, phone: string): Promise<void> {
    const entry = await this.prisma.blacklist.findUnique({
      where: { instanceId_phone: { instanceId, phone } },
    });

    if (entry) {
      await this.prisma.blacklist.update({
        where: { id: entry.id },
        data: { failCount: entry.failCount + 1 },
      });
      return;
    }

    const autoBlacklistThreshold = 5;

    const recentFailures = await this.prisma.message.count({
      where: {
        instanceId,
        status: 'FAILED',
        content: { path: ['to'], equals: phone },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (recentFailures >= autoBlacklistThreshold) {
      await this.prisma.blacklist.create({
        data: {
          instanceId,
          phone,
          reason: `Auto-blacklisted: ${recentFailures} consecutive failures in 24h`,
          failCount: recentFailures,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      await this.syncBlacklistCache(instanceId);

      this.logger.warn(
        { instanceId, phone, failures: recentFailures },
        'Phone auto-blacklisted due to consecutive failures',
      );
    }
  }

  // ─── Whitelist ────────────────────────────────────────

  async getWhitelist(tenantId: string, instanceId: string) {
    await this.instancesService.findOne(tenantId, instanceId);

    const entries = await this.prisma.whitelist.findMany({
      where: { instanceId },
      orderBy: { createdAt: 'desc' },
    });

    return { whitelist: entries };
  }

  async addToWhitelist(
    tenantId: string,
    instanceId: string,
    dto: AddWhitelistDto,
  ) {
    await this.instancesService.findOne(tenantId, instanceId);

    const existing = await this.prisma.whitelist.findUnique({
      where: { instanceId_phone: { instanceId, phone: dto.phone } },
    });

    if (existing) {
      throw new ConflictException(
        `Phone ${dto.phone} is already whitelisted`,
      );
    }

    const entry = await this.prisma.whitelist.create({
      data: {
        instanceId,
        phone: dto.phone,
      },
    });

    await this.syncWhitelistCache(instanceId);

    this.logger.log(
      { instanceId, phone: dto.phone },
      'Phone added to whitelist',
    );

    return entry;
  }

  async removeFromWhitelist(
    tenantId: string,
    instanceId: string,
    phone: string,
  ) {
    await this.instancesService.findOne(tenantId, instanceId);

    const entry = await this.prisma.whitelist.findUnique({
      where: { instanceId_phone: { instanceId, phone } },
    });

    if (!entry) {
      throw new NotFoundException(
        `Phone ${phone} not found in whitelist`,
      );
    }

    await this.prisma.whitelist.delete({
      where: { id: entry.id },
    });

    await this.syncWhitelistCache(instanceId);

    this.logger.log(
      { instanceId, phone },
      'Phone removed from whitelist',
    );

    return { message: 'Phone removed from whitelist' };
  }

  async isWhitelisted(instanceId: string, phone: string): Promise<boolean> {
    const cacheKey = `whitelist:${instanceId}`;
    const cached = await this.redis.hget(cacheKey, phone);

    if (cached !== null) {
      return cached === '1';
    }

    const entry = await this.prisma.whitelist.findUnique({
      where: { instanceId_phone: { instanceId, phone } },
    });

    const isAllowed = !!entry;
    await this.redis.hset(cacheKey, phone, isAllowed ? '1' : '0');
    await this.redis.expire(cacheKey, BLACKLIST_CACHE_TTL);

    return isAllowed;
  }

  // ─── Cache Sync ───────────────────────────────────────

  private async syncBlacklistCache(instanceId: string): Promise<void> {
    const cacheKey = `blacklist:${instanceId}`;
    await this.redis.del(cacheKey);

    const entries = await this.prisma.blacklist.findMany({
      where: { instanceId },
    });

    for (const entry of entries) {
      await this.redis.hset(cacheKey, entry.phone, '1');
    }

    if (entries.length > 0) {
      await this.redis.expire(cacheKey, BLACKLIST_CACHE_TTL);
    }
  }

  private async syncWhitelistCache(instanceId: string): Promise<void> {
    const cacheKey = `whitelist:${instanceId}`;
    await this.redis.del(cacheKey);

    const entries = await this.prisma.whitelist.findMany({
      where: { instanceId },
    });

    for (const entry of entries) {
      await this.redis.hset(cacheKey, entry.phone, '1');
    }

    if (entries.length > 0) {
      await this.redis.expire(cacheKey, BLACKLIST_CACHE_TTL);
    }
  }
}

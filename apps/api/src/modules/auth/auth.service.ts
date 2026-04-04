import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@nexconnect/database';
import { RedisService } from '@nexconnect/redis';
import { CryptoUtil, UlidUtil } from '@nexconnect/shared';

interface ValidatedApiKey {
  tenant: { id: string; name: string; plan: string };
  scopes: string[];
  apiKeyId: string;
}

interface CreatedApiKey {
  key: string;
  id: string;
}

interface CachedApiKey {
  id: string;
  keyHash: string;
  scopes: string[];
  expiresAt: string | null;
  tenant: { id: string; name: string; plan: string };
}

const API_KEY_CACHE_TTL_SECONDS = 300;
const API_KEY_CACHE_PREFIX = 'auth:apikey:';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async validateApiKey(rawKey: string): Promise<ValidatedApiKey> {
    const prefix = rawKey.substring(0, 8);

    const cached = await this.getFromCache(prefix);
    if (cached && CryptoUtil.verifyApiKey(rawKey, cached.keyHash)) {
      return this.buildResult(cached);
    }

    const apiKey = await this.prisma.apiKey.findFirst({
      where: { prefix, active: true },
      include: {
        tenant: {
          select: { id: true, name: true, plan: true },
        },
      },
    });

    if (!apiKey || !CryptoUtil.verifyApiKey(rawKey, apiKey.keyHash)) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    await this.setCache(prefix, {
      id: apiKey.id,
      keyHash: apiKey.keyHash,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt?.toISOString() ?? null,
      tenant: apiKey.tenant,
    });

    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return this.buildResult({
      id: apiKey.id,
      keyHash: apiKey.keyHash,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt?.toISOString() ?? null,
      tenant: apiKey.tenant,
    });
  }

  async createApiKey(
    tenantId: string,
    name: string,
    scopes: string[],
  ): Promise<CreatedApiKey> {
    const generated = CryptoUtil.generateApiKey();
    const id = UlidUtil.generate();

    await this.prisma.apiKey.create({
      data: {
        id,
        name,
        keyHash: generated.hash,
        prefix: generated.prefix,
        scopes,
        tenantId,
      },
    });

    return { key: generated.raw, id };
  }

  async revokeApiKey(apiKeyId: string, tenantId: string): Promise<void> {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, tenantId },
      select: { prefix: true },
    });

    await this.prisma.apiKey.updateMany({
      where: { id: apiKeyId, tenantId },
      data: { active: false },
    });

    if (apiKey) {
      await this.redis.del(`${API_KEY_CACHE_PREFIX}${apiKey.prefix}`);
    }
  }

  private buildResult(cached: CachedApiKey): ValidatedApiKey {
    return {
      tenant: cached.tenant,
      scopes: cached.scopes,
      apiKeyId: cached.id,
    };
  }

  private async getFromCache(prefix: string): Promise<CachedApiKey | null> {
    const raw = await this.redis.get(`${API_KEY_CACHE_PREFIX}${prefix}`);
    if (!raw) return null;

    const cached: CachedApiKey = JSON.parse(raw);

    if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
      await this.redis.del(`${API_KEY_CACHE_PREFIX}${prefix}`);
      return null;
    }

    return cached;
  }

  private async setCache(prefix: string, data: CachedApiKey): Promise<void> {
    await this.redis.set(
      `${API_KEY_CACHE_PREFIX}${prefix}`,
      JSON.stringify(data),
      API_KEY_CACHE_TTL_SECONDS,
    );
  }
}

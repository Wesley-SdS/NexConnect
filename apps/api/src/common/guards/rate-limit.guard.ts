import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyReply, FastifyRequest } from 'fastify';
import { RedisService } from '@nexconnect/redis';
import {
  RateLimitExceededException,
  getTenantLimits,
  isUnlimited,
  TenantPlan,
} from '@nexconnect/shared';
import {
  RATE_LIMIT_KEY,
  RateLimitLevel,
  RateLimitOptions,
} from '../decorators/rate-limit.decorator';
import { IS_PUBLIC_KEY } from './api-key.guard';

interface RateLimitConfig {
  key: string;
  limit: number;
  windowSeconds: number;
}

const DEFAULT_LIMITS: Record<RateLimitLevel, { limit: number; window: number }> = {
  'api-key': { limit: 1000, window: 60 },
  instance: { limit: 100, window: 60 },
  recipient: { limit: 10, window: 60 },
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();

    const customOptions = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    const tenant = (request as FastifyRequest & { tenant?: { plan?: string } }).tenant;
    const configs = this.buildConfigs(request, customOptions, tenant?.plan);

    for (const config of configs) {
      await this.checkLimit(config, reply);
    }

    return true;
  }

  private buildConfigs(
    request: FastifyRequest,
    customOptions?: RateLimitOptions,
    tenantPlan?: string,
  ): RateLimitConfig[] {
    const configs: RateLimitConfig[] = [];
    const req = request as FastifyRequest & {
      apiKeyId?: string;
      params: Record<string, string>;
      body?: Record<string, unknown>;
    };
    const apiKeyId = req.apiKeyId;
    const params = req.params;
    const body = req.body;

    // Use tenant plan limits when available, fall back to DEFAULT_LIMITS for public routes
    const tenantLimits = tenantPlan
      ? getTenantLimits(tenantPlan as TenantPlan)
      : null;

    if (apiKeyId) {
      const defaults = DEFAULT_LIMITS['api-key'];
      const planLimit = tenantLimits?.apiRequestsPerMinute;
      const effectiveLimit =
        planLimit && !isUnlimited(planLimit) ? planLimit : defaults.limit;

      configs.push({
        key: `rl:apikey:${apiKeyId}`,
        limit:
          customOptions?.level === 'api-key' && customOptions.limit
            ? customOptions.limit
            : effectiveLimit,
        windowSeconds: defaults.window,
      });
    }

    const instanceId = params?.instanceId ?? params?.id;
    if (instanceId) {
      const defaults = DEFAULT_LIMITS['instance'];
      configs.push({
        key: `rl:instance:${instanceId}`,
        limit:
          customOptions?.level === 'instance' && customOptions.limit
            ? customOptions.limit
            : defaults.limit,
        windowSeconds: defaults.window,
      });
    }

    const recipient = body?.to as string | undefined; // recipient phone from body
    if (recipient && instanceId) {
      const defaults = DEFAULT_LIMITS['recipient'];
      configs.push({
        key: `rl:recipient:${instanceId}:${recipient}`,
        limit:
          customOptions?.level === 'recipient' && customOptions.limit
            ? customOptions.limit
            : defaults.limit,
        windowSeconds: defaults.window,
      });
    }

    return configs;
  }

  private async checkLimit(
    config: RateLimitConfig,
    reply: FastifyReply,
  ): Promise<void> {
    const current = await this.redis.incrWithTtl(config.key, config.windowSeconds);

    const ttl = await this.redis.getClient().ttl(config.key);
    const remaining = Math.max(0, config.limit - current);
    const resetTimestamp = Math.floor(Date.now() / 1000) + Math.max(ttl, 0);

    reply.header('X-RateLimit-Limit', String(config.limit));
    reply.header('X-RateLimit-Remaining', String(remaining));
    reply.header('X-RateLimit-Reset', String(resetTimestamp));

    if (current > config.limit) {
      this.logger.warn(
        { key: config.key, current, limit: config.limit },
        'Rate limit exceeded',
      );
      throw new RateLimitExceededException(
        `Rate limit exceeded: ${current}/${config.limit} requests in ${config.windowSeconds}s window`,
      );
    }
  }
}

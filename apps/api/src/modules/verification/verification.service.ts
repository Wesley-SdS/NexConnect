import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import { RedisService } from '@nexconnect/redis';
import { PhoneUtil } from '@nexconnect/shared';
import { InstancesService } from '../instances/instances.service';

export interface VerificationResult {
  phone: string;
  exists: boolean;
  jid: string | null;
  profilePicUrl?: string;
  pushName?: string;
}

const CACHE_TTL_SECONDS = 86400; // 24h

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly instancesService: InstancesService,
    @InjectQueue('verification')
    private readonly verificationQueue: Queue,
  ) {}

  async verifySingle(
    tenantId: string,
    instanceId: string,
    phone: string,
  ): Promise<VerificationResult> {
    await this.instancesService.findOne(tenantId, instanceId);

    const normalized = PhoneUtil.normalize(phone);
    const cacheKey = `verification:${instanceId}:${normalized}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.debug({ phone: normalized }, 'Verification cache hit');
      return JSON.parse(cached);
    }

    const job = await this.verificationQueue.add(
      'verify-number',
      {
        instanceId,
        tenantId,
        phone: normalized,
      },
      {
        jobId: `verify:${instanceId}:${normalized}`,
      },
    );

    const queueEvents = new QueueEvents('verification');
    const result = await job.waitUntilFinished(
      queueEvents,
      30_000,
    );

    const verificationResult: VerificationResult = {
      phone: normalized,
      exists: result?.exists ?? false,
      jid: result?.jid ?? null,
      profilePicUrl: result?.profilePicUrl,
      pushName: result?.pushName,
    };

    await this.redis.set(
      cacheKey,
      JSON.stringify(verificationResult),
      CACHE_TTL_SECONDS,
    );

    this.logger.log(
      { phone: normalized, exists: verificationResult.exists },
      'Number verified',
    );

    return verificationResult;
  }

  async verifyBatch(
    tenantId: string,
    instanceId: string,
    phones: string[],
  ): Promise<VerificationResult[]> {
    await this.instancesService.findOne(tenantId, instanceId);

    const limitedPhones = phones.slice(0, 100);

    const results = await Promise.allSettled(
      limitedPhones.map((phone) =>
        this.verifySingle(tenantId, instanceId, phone),
      ),
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      this.logger.warn(
        { phone: limitedPhones[index], error: result.reason?.message },
        'Batch verification item failed',
      );

      return {
        phone: limitedPhones[index],
        exists: false,
        jid: null,
        error: result.reason?.message ?? 'Verification failed',
      } as VerificationResult & { error?: string };
    });
  }
}

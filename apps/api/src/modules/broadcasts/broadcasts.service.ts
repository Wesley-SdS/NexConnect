import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@nexconnect/database';
import { UlidUtil } from '@nexconnect/shared';
import type { Prisma } from '@prisma/client';
import { InstancesService } from '../instances/instances.service';
import { BroadcastStrategyFactory, BroadcastStrategyType } from './strategies/broadcast-strategy.factory';

const DEFAULT_DELAY_BETWEEN_MS = 2000;
const MIN_VARIANTS_FOR_AB_TEST = 2;
const VARIANT_WEIGHT_TOTAL = 100;

export interface BroadcastVariant {
  name: string;
  content: Record<string, unknown>;
  weight: number;
}

@Injectable()
export class BroadcastsService {
  private readonly logger = new Logger(BroadcastsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly instancesService: InstancesService,
    private readonly strategyFactory: BroadcastStrategyFactory,
    @InjectQueue('broadcast-messages')
    private readonly broadcastQueue: Queue,
  ) {}

  async create(tenantId: string, data: {
    instanceIds: string[];
    recipients: string[];
    type: string;
    content: Record<string, unknown>;
    delayBetweenMs?: number;
    variants?: BroadcastVariant[];
    strategy?: BroadcastStrategyType;
  }) {
    if (!data.instanceIds.length) {
      throw new BadRequestException('At least one instance is required');
    }

    if (!data.recipients.length) {
      throw new BadRequestException('At least one recipient is required');
    }

    if (data.variants?.length) {
      this.validateVariants(data.variants);
    }

    for (const instanceId of data.instanceIds) {
      await this.instancesService.findOne(tenantId, instanceId);
    }

    const id = UlidUtil.generate();
    const strategyType = data.strategy ?? 'round_robin';
    const strategy = this.strategyFactory.getStrategy(strategyType);

    const variantsPayload = data.variants?.map((v) => ({
      name: v.name,
      content: v.content,
      weight: v.weight,
      sentCount: 0,
      failedCount: 0,
    }));

    const broadcast = await this.prisma.broadcast.create({
      data: {
        id,
        tenantId,
        instanceIds: data.instanceIds,
        totalRecipients: data.recipients.length,
        type: data.type,
        content: data.content as Prisma.JsonValue,
        status: 'queued',
        strategy: strategyType,
        sentCount: 0,
        failedCount: 0,
        ...(variantsPayload && {
          variants: variantsPayload as Prisma.JsonValue,
        }),
      },
    });

    const delayBetween = data.delayBetweenMs ?? DEFAULT_DELAY_BETWEEN_MS;

    for (let i = 0; i < data.recipients.length; i++) {
      const instanceId = await strategy.selectInstance(data.instanceIds, i);

      const variant = data.variants?.length
        ? this.getVariantForRecipient(data.variants, i)
        : null;

      const content = variant ? variant.content : data.content;

      await this.broadcastQueue.add(
        'send-broadcast-message',
        {
          broadcastId: id,
          instanceId,
          tenantId,
          to: data.recipients[i],
          type: data.type,
          content,
          index: i,
          ...(variant && { variantName: variant.name }),
        },
        {
          delay: i * delayBetween,
          jobId: `${id}-${i}`,
        },
      );
    }

    this.logger.log(
      {
        broadcastId: id,
        recipients: data.recipients.length,
        instances: data.instanceIds.length,
        strategy: strategyType,
        variants: data.variants?.map((v) => v.name),
      },
      'broadcast.created',
    );

    return broadcast;
  }

  async findAll(tenantId: string, page: number, limit: number) {
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    const [broadcasts, total] = await Promise.all([
      this.prisma.broadcast.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.broadcast.count({ where: { tenantId } }),
    ]);

    return {
      broadcasts,
      pagination: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, tenantId },
    });

    if (!broadcast) {
      throw new NotFoundException(`Broadcast ${id} not found`);
    }

    return broadcast;
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: 'paused' | 'active',
  ) {
    const broadcast = await this.findOne(tenantId, id);

    if (broadcast.status === 'completed' || broadcast.status === 'cancelled') {
      throw new BadRequestException(
        `Cannot change status of a ${broadcast.status} broadcast`,
      );
    }

    if (status === 'paused') {
      const jobs = await this.broadcastQueue.getJobs(['delayed', 'waiting']);
      const broadcastJobs = jobs.filter(
        (job) => job.data?.broadcastId === id,
      );

      for (const job of broadcastJobs) {
        await job.remove();
      }

      this.logger.log(
        { broadcastId: id, removedJobs: broadcastJobs.length },
        'broadcast.paused',
      );
    }

    if (status === 'active' && broadcast.status === 'paused') {
      this.logger.log({ broadcastId: id }, 'broadcast.resumed');
    }

    return this.prisma.broadcast.update({
      where: { id },
      data: { status },
    });
  }

  getVariantForRecipient(
    variants: BroadcastVariant[],
    index: number,
  ): BroadcastVariant {
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    const normalizedPosition = index % totalWeight;
    let accumulated = 0;

    for (const variant of variants) {
      accumulated += variant.weight;
      if (normalizedPosition < accumulated) {
        return variant;
      }
    }

    return variants[variants.length - 1];
  }

  private validateVariants(variants: BroadcastVariant[]): void {
    if (variants.length < MIN_VARIANTS_FOR_AB_TEST) {
      throw new BadRequestException(
        `A/B testing requires at least ${MIN_VARIANTS_FOR_AB_TEST} variants`,
      );
    }

    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight !== VARIANT_WEIGHT_TOTAL) {
      throw new BadRequestException(
        `Variant weights must sum to ${VARIANT_WEIGHT_TOTAL}, got ${totalWeight}`,
      );
    }

    const names = new Set(variants.map((v) => v.name));
    if (names.size !== variants.length) {
      throw new BadRequestException('Variant names must be unique');
    }
  }
}

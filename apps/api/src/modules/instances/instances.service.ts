import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@nexconnect/database';
import { RedisService } from '@nexconnect/redis';
import {
  UlidUtil,
  InstanceNotFoundException,
  QR_CODE_EXPIRY_MS,
} from '@nexconnect/shared';
import {
  CreateInstanceDto,
  UpdateInstanceDto,
} from '@nexconnect/core';
import type { Prisma } from '@prisma/client';
import { QrCodeService, type QrCodeResult } from './qrcode.service';

@Injectable()
export class InstancesService {
  private readonly logger = new Logger(InstancesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly qrCodeService: QrCodeService,
    @InjectQueue('instance-lifecycle')
    private readonly lifecycleQueue: Queue,
  ) {}

  async create(tenantId: string, dto: CreateInstanceDto) {
    const id = UlidUtil.generate();

    const instance = await this.prisma.instance.create({
      data: {
        id,
        tenantId,
        name: dto.name,
        connectionType: dto.connectionType,
        status: 'DISCONNECTED',
        settings: (dto.settings ?? {}) as Prisma.JsonValue,
      },
    });

    this.logger.log({ instanceId: id, tenantId }, 'instance.created');

    return instance;
  }

  async findAll(tenantId: string) {
    return this.prisma.instance.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const instance = await this.prisma.instance.findFirst({
      where: { id, tenantId },
    });

    if (!instance) {
      throw new InstanceNotFoundException(id);
    }

    return instance;
  }

  async update(tenantId: string, id: string, dto: UpdateInstanceDto) {
    await this.findOne(tenantId, id);

    return this.prisma.instance.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.connectionType !== undefined && { connectionType: dto.connectionType }),
        ...(dto.settings !== undefined && { settings: dto.settings as Prisma.JsonValue }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    await this.lifecycleQueue.add('disconnect', {
      instanceId: id,
      tenantId,
    });

    return this.prisma.instance.delete({
      where: { id },
    });
  }

  async getQrCode(tenantId: string, id: string): Promise<QrCodeResult> {
    await this.findOne(tenantId, id);

    const qrData = await this.redis.get(`instance:${id}:qrcode`);

    if (!qrData) {
      throw new NotFoundException('QR code not available. Start the instance first.');
    }

    const result = await this.qrCodeService.generate(qrData, QR_CODE_EXPIRY_MS);

    this.logger.debug({ instanceId: id }, 'qrcode.retrieved');

    return result;
  }
}

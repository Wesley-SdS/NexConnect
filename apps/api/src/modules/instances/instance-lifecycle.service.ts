import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@nexconnect/database';
import { UpdateProfileDto } from '@nexconnect/core';
import { InstancesService } from './instances.service';

@Injectable()
export class InstanceLifecycleService {
  private readonly logger = new Logger(InstanceLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly instancesService: InstancesService,
    @InjectQueue('instance-lifecycle')
    private readonly lifecycleQueue: Queue,
  ) {}

  async powerOn(tenantId: string, id: string) {
    const instance = await this.instancesService.findOne(tenantId, id);

    await this.lifecycleQueue.add('connect', {
      instanceId: id,
      tenantId,
    });

    await this.prisma.instance.update({
      where: { id },
      data: { status: 'CONNECTING' },
    });

    this.logger.log({ instanceId: id }, 'instance.power_on');

    return { message: 'Instance is powering on', instanceId: instance.id };
  }

  async powerOff(tenantId: string, id: string) {
    await this.instancesService.findOne(tenantId, id);

    await this.lifecycleQueue.add('disconnect', {
      instanceId: id,
      tenantId,
    });

    await this.prisma.instance.update({
      where: { id },
      data: { status: 'DISCONNECTED' },
    });

    this.logger.log({ instanceId: id }, 'instance.power_off');

    return { message: 'Instance is powering off' };
  }

  async restart(tenantId: string, id: string) {
    await this.instancesService.findOne(tenantId, id);

    await this.lifecycleQueue.add('restart', {
      instanceId: id,
      tenantId,
    });

    await this.prisma.instance.update({
      where: { id },
      data: { status: 'CONNECTING' },
    });

    this.logger.log({ instanceId: id }, 'instance.restart');

    return { message: 'Instance is restarting' };
  }

  async updateProfile(tenantId: string, id: string, dto: UpdateProfileDto) {
    await this.instancesService.findOne(tenantId, id);

    await this.lifecycleQueue.add('update-profile', {
      instanceId: id,
      tenantId,
      profile: dto,
    });

    this.logger.log({ instanceId: id }, 'instance.profile_update_requested');

    return { message: 'Profile update requested' };
  }

  async getPairingCode(tenantId: string, id: string, phoneNumber: string) {
    await this.instancesService.findOne(tenantId, id);

    await this.lifecycleQueue.add('request-pairing-code', {
      instanceId: id,
      tenantId,
      phoneNumber,
    });

    return { message: 'Pairing code requested. Check instance status.' };
  }
}

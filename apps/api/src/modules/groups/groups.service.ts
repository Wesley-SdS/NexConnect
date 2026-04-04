import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InstancesService } from '../instances/instances.service';

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    private readonly instancesService: InstancesService,
    @InjectQueue('group-operations')
    private readonly groupQueue: Queue,
  ) {}

  async create(tenantId: string, instanceId: string, name: string, participants: string[]) {
    await this.instancesService.findOne(tenantId, instanceId);

    const job = await this.groupQueue.add('create-group', {
      instanceId,
      tenantId,
      name,
      participants,
    });

    this.logger.log(
      { instanceId, tenantId, name, participantCount: participants.length, jobId: job.id },
      'Group creation dispatched',
    );

    return { message: 'Group creation dispatched', jobId: job.id };
  }

  async findAll(tenantId: string, instanceId: string) {
    await this.instancesService.findOne(tenantId, instanceId);

    const job = await this.groupQueue.add('list-groups', {
      instanceId,
      tenantId,
    });

    return { message: 'Group list fetch dispatched', jobId: job.id };
  }

  async findOne(tenantId: string, instanceId: string, groupJid: string) {
    await this.instancesService.findOne(tenantId, instanceId);

    const job = await this.groupQueue.add('get-group-metadata', {
      instanceId,
      tenantId,
      groupJid,
    });

    return { message: 'Group metadata fetch dispatched', jobId: job.id };
  }

  async update(
    tenantId: string,
    instanceId: string,
    groupJid: string,
    data: { name?: string; description?: string },
  ) {
    await this.instancesService.findOne(tenantId, instanceId);

    const job = await this.groupQueue.add('update-group', {
      instanceId,
      tenantId,
      groupJid,
      ...data,
    });

    return { message: 'Group update dispatched', jobId: job.id };
  }

  async addParticipants(
    tenantId: string,
    instanceId: string,
    groupJid: string,
    participants: string[],
  ) {
    await this.instancesService.findOne(tenantId, instanceId);

    const job = await this.groupQueue.add('add-participants', {
      instanceId,
      tenantId,
      groupJid,
      participants,
    });

    return { message: 'Add participants dispatched', jobId: job.id };
  }

  async removeParticipants(
    tenantId: string,
    instanceId: string,
    groupJid: string,
    participants: string[],
  ) {
    await this.instancesService.findOne(tenantId, instanceId);

    const job = await this.groupQueue.add('remove-participants', {
      instanceId,
      tenantId,
      groupJid,
      participants,
    });

    return { message: 'Remove participants dispatched', jobId: job.id };
  }

  async promoteParticipants(
    tenantId: string,
    instanceId: string,
    groupJid: string,
    participants: string[],
  ) {
    await this.instancesService.findOne(tenantId, instanceId);

    const job = await this.groupQueue.add('promote-participants', {
      instanceId,
      tenantId,
      groupJid,
      participants,
    });

    return { message: 'Promote participants dispatched', jobId: job.id };
  }

  async demoteParticipants(
    tenantId: string,
    instanceId: string,
    groupJid: string,
    participants: string[],
  ) {
    await this.instancesService.findOne(tenantId, instanceId);

    const job = await this.groupQueue.add('demote-participants', {
      instanceId,
      tenantId,
      groupJid,
      participants,
    });

    return { message: 'Demote participants dispatched', jobId: job.id };
  }

  async leave(tenantId: string, instanceId: string, groupJid: string) {
    await this.instancesService.findOne(tenantId, instanceId);

    const job = await this.groupQueue.add('leave-group', {
      instanceId,
      tenantId,
      groupJid,
    });

    this.logger.log(
      { instanceId, tenantId, groupJid, jobId: job.id },
      'Leave group dispatched',
    );

    return { message: 'Leave group dispatched', jobId: job.id };
  }

  async getInviteCode(tenantId: string, instanceId: string, groupJid: string) {
    await this.instancesService.findOne(tenantId, instanceId);

    const job = await this.groupQueue.add('get-invite-code', {
      instanceId,
      tenantId,
      groupJid,
    });

    return { message: 'Invite code fetch dispatched', jobId: job.id };
  }

  async revokeInviteCode(tenantId: string, instanceId: string, groupJid: string) {
    await this.instancesService.findOne(tenantId, instanceId);

    const job = await this.groupQueue.add('revoke-invite-code', {
      instanceId,
      tenantId,
      groupJid,
    });

    return { message: 'Invite code revoke dispatched', jobId: job.id };
  }

  async updateSettings(
    tenantId: string,
    instanceId: string,
    groupJid: string,
    settings: Record<string, any>,
  ) {
    await this.instancesService.findOne(tenantId, instanceId);

    const job = await this.groupQueue.add('update-group-settings', {
      instanceId,
      tenantId,
      groupJid,
      settings,
    });

    return { message: 'Group settings update dispatched', jobId: job.id };
  }

  async joinViaLink(tenantId: string, instanceId: string, inviteLink: string) {
    await this.instancesService.findOne(tenantId, instanceId);

    const job = await this.groupQueue.add('join-group-via-link', {
      instanceId,
      tenantId,
      inviteLink,
    });

    return { message: 'Join via invite link dispatched', jobId: job.id };
  }

  async listParticipants(tenantId: string, instanceId: string, groupJid: string) {
    await this.instancesService.findOne(tenantId, instanceId);

    const job = await this.groupQueue.add('list-participants', {
      instanceId,
      tenantId,
      groupJid,
    });

    return { message: 'List participants dispatched', jobId: job.id };
  }
}

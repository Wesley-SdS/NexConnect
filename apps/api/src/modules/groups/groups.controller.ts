import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';

class CreateGroupDto {
  instanceId!: string;
  name!: string;
  participants!: string[];
}

class UpdateGroupDto {
  name?: string;
  description?: string;
}

class GroupParticipantsDto {
  participants!: string[];
}

@Controller('instances/:instanceId/groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @RequiredScopes('admin')
  create(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body() dto: CreateGroupDto,
  ) {
    return this.groupsService.create(tenant.id, instanceId, dto.name, dto.participants);
  }

  @Get()
  @RequiredScopes('read')
  findAll(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
  ) {
    return this.groupsService.findAll(tenant.id, instanceId);
  }

  @Get(':groupJid')
  @RequiredScopes('read')
  findOne(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('groupJid') groupJid: string,
  ) {
    return this.groupsService.findOne(tenant.id, instanceId, groupJid);
  }

  @Patch(':groupJid')
  @RequiredScopes('admin')
  update(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('groupJid') groupJid: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.update(tenant.id, instanceId, groupJid, dto);
  }

  @Post(':groupJid/participants/add')
  @RequiredScopes('admin')
  addParticipants(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('groupJid') groupJid: string,
    @Body() dto: GroupParticipantsDto,
  ) {
    return this.groupsService.addParticipants(tenant.id, instanceId, groupJid, dto.participants);
  }

  @Post(':groupJid/participants/remove')
  @RequiredScopes('admin')
  removeParticipants(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('groupJid') groupJid: string,
    @Body() dto: GroupParticipantsDto,
  ) {
    return this.groupsService.removeParticipants(tenant.id, instanceId, groupJid, dto.participants);
  }

  @Post(':groupJid/participants/promote')
  @RequiredScopes('admin')
  promoteParticipants(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('groupJid') groupJid: string,
    @Body() dto: GroupParticipantsDto,
  ) {
    return this.groupsService.promoteParticipants(tenant.id, instanceId, groupJid, dto.participants);
  }

  @Post(':groupJid/participants/demote')
  @RequiredScopes('admin')
  demoteParticipants(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('groupJid') groupJid: string,
    @Body() dto: GroupParticipantsDto,
  ) {
    return this.groupsService.demoteParticipants(tenant.id, instanceId, groupJid, dto.participants);
  }

  @Delete(':groupJid/leave')
  @RequiredScopes('admin')
  leave(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('groupJid') groupJid: string,
  ) {
    return this.groupsService.leave(tenant.id, instanceId, groupJid);
  }

  @Get(':groupJid/invite-code')
  @RequiredScopes('admin')
  getInviteCode(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('groupJid') groupJid: string,
  ) {
    return this.groupsService.getInviteCode(tenant.id, instanceId, groupJid);
  }

  @Post(':groupJid/invite-code/revoke')
  @RequiredScopes('admin')
  revokeInviteCode(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('groupJid') groupJid: string,
  ) {
    return this.groupsService.revokeInviteCode(tenant.id, instanceId, groupJid);
  }

  @Patch(':groupJid/settings')
  @RequiredScopes('admin')
  updateSettings(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('groupJid') groupJid: string,
    @Body() settings: Record<string, any>,
  ) {
    return this.groupsService.updateSettings(tenant.id, instanceId, groupJid, settings);
  }
}

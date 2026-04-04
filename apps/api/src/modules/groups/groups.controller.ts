import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiBody, ApiProperty } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';

class CreateGroupDto {
  @ApiProperty({ description: 'Instance ID that will own the group', example: 'uuid-instance' })
  instanceId!: string;

  @ApiProperty({ description: 'Group display name', example: 'Support Team' })
  name!: string;

  @ApiProperty({ description: 'Initial participant phone numbers', example: ['5511999999999'] })
  participants!: string[];
}

class UpdateGroupDto {
  @ApiProperty({ description: 'New group name', example: 'VIP Support', required: false })
  name?: string;

  @ApiProperty({ description: 'New group description', example: 'Priority support channel', required: false })
  description?: string;
}

class GroupParticipantsDto {
  @ApiProperty({ description: 'Participant phone numbers', example: ['5511999999999', '5511888888888'] })
  participants!: string[];
}

@ApiTags('Groups')
@ApiBearerAuth()
@Controller('instances/:instanceId/groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Create group', description: 'Creates a new WhatsApp group with the specified participants' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiBody({ type: CreateGroupDto })
  @ApiResponse({ status: 201, description: 'Group created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  create(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body() dto: CreateGroupDto,
  ) {
    return this.groupsService.create(tenant.id, instanceId, dto.name, dto.participants);
  }

  @Get()
  @RequiredScopes('read')
  @ApiOperation({ summary: 'List groups', description: 'Lists all WhatsApp groups for the instance' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiResponse({ status: 200, description: 'Groups retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  findAll(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
  ) {
    return this.groupsService.findAll(tenant.id, instanceId);
  }

  @Get(':groupJid')
  @RequiredScopes('read')
  @ApiOperation({ summary: 'Get group by JID', description: 'Returns detailed information about a specific group' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiParam({ name: 'groupJid', description: 'WhatsApp group JID' })
  @ApiResponse({ status: 200, description: 'Group retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Group or instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  findOne(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('groupJid') groupJid: string,
  ) {
    return this.groupsService.findOne(tenant.id, instanceId, groupJid);
  }

  @Patch(':groupJid')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Update group', description: 'Updates group name and/or description' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiParam({ name: 'groupJid', description: 'WhatsApp group JID' })
  @ApiBody({ type: UpdateGroupDto })
  @ApiResponse({ status: 200, description: 'Group updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Group or instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
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
  @ApiOperation({ summary: 'Add participants', description: 'Adds new participants to the group' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiParam({ name: 'groupJid', description: 'WhatsApp group JID' })
  @ApiBody({ type: GroupParticipantsDto })
  @ApiResponse({ status: 200, description: 'Participants added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Group or instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
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
  @ApiOperation({ summary: 'Remove participants', description: 'Removes participants from the group' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiParam({ name: 'groupJid', description: 'WhatsApp group JID' })
  @ApiBody({ type: GroupParticipantsDto })
  @ApiResponse({ status: 200, description: 'Participants removed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Group or instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
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
  @ApiOperation({ summary: 'Promote participants', description: 'Promotes participants to group admin' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiParam({ name: 'groupJid', description: 'WhatsApp group JID' })
  @ApiBody({ type: GroupParticipantsDto })
  @ApiResponse({ status: 200, description: 'Participants promoted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Group or instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
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
  @ApiOperation({ summary: 'Demote participants', description: 'Demotes group admins to regular participants' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiParam({ name: 'groupJid', description: 'WhatsApp group JID' })
  @ApiBody({ type: GroupParticipantsDto })
  @ApiResponse({ status: 200, description: 'Participants demoted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Group or instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
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
  @ApiOperation({ summary: 'Leave group', description: 'Makes the instance leave the specified group' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiParam({ name: 'groupJid', description: 'WhatsApp group JID' })
  @ApiResponse({ status: 200, description: 'Left group successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Group or instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  leave(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('groupJid') groupJid: string,
  ) {
    return this.groupsService.leave(tenant.id, instanceId, groupJid);
  }

  @Get(':groupJid/invite-code')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Get invite code', description: 'Retrieves the current invite code for the group' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiParam({ name: 'groupJid', description: 'WhatsApp group JID' })
  @ApiResponse({ status: 200, description: 'Invite code retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Group or instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  getInviteCode(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('groupJid') groupJid: string,
  ) {
    return this.groupsService.getInviteCode(tenant.id, instanceId, groupJid);
  }

  @Post(':groupJid/invite-code/revoke')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Revoke invite code', description: 'Revokes the current invite code and generates a new one' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiParam({ name: 'groupJid', description: 'WhatsApp group JID' })
  @ApiResponse({ status: 200, description: 'Invite code revoked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Group or instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  revokeInviteCode(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('groupJid') groupJid: string,
  ) {
    return this.groupsService.revokeInviteCode(tenant.id, instanceId, groupJid);
  }

  @Patch(':groupJid/settings')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Update group settings', description: 'Updates group settings such as who can send messages or edit group info' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiParam({ name: 'groupJid', description: 'WhatsApp group JID' })
  @ApiResponse({ status: 200, description: 'Group settings updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid settings' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Group or instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  updateSettings(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('groupJid') groupJid: string,
    @Body() settings: Record<string, any>,
  ) {
    return this.groupsService.updateSettings(tenant.id, instanceId, groupJid, settings);
  }

  @Post('join')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Join group via link', description: 'Joins a group using an invite link' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiResponse({ status: 200, description: 'Joined group successfully' })
  @ApiResponse({ status: 400, description: 'Invalid invite link' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  joinViaLink(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body('inviteLink') inviteLink: string,
  ) {
    return this.groupsService.joinViaLink(tenant.id, instanceId, inviteLink);
  }

  @Get(':groupJid/participants')
  @RequiredScopes('read')
  @ApiOperation({ summary: 'List participants', description: 'Lists all participants of the specified group' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiParam({ name: 'groupJid', description: 'WhatsApp group JID' })
  @ApiResponse({ status: 200, description: 'Participants retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Group or instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  listParticipants(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('groupJid') groupJid: string,
  ) {
    return this.groupsService.listParticipants(tenant.id, instanceId, groupJid);
  }
}

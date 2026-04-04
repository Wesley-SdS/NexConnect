import { Body, Controller, Param, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiBody, ApiProperty } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { InstancesService } from './instances.service';

class UpdatePresenceDto {
  @ApiProperty({ description: 'Presence state', enum: ['available', 'unavailable', 'composing', 'recording', 'paused'], example: 'composing' })
  presence!: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused';

  @ApiProperty({ description: 'Target chat JID (optional, defaults to all chats)', example: '5511999999999@s.whatsapp.net', required: false })
  jid?: string;
}

@ApiTags('Presence')
@ApiBearerAuth()
@Controller('instances')
export class PresenceController {
  constructor(
    private readonly instancesService: InstancesService,
    @InjectQueue('instance-lifecycle')
    private readonly lifecycleQueue: Queue,
  ) {}

  @Patch(':id/presence')
  @RequiredScopes('send')
  @ApiOperation({ summary: 'Update presence', description: 'Updates the online presence state (typing, recording, available) for the instance' })
  @ApiParam({ name: 'id', description: 'Instance UUID' })
  @ApiBody({ type: UpdatePresenceDto })
  @ApiResponse({ status: 200, description: 'Presence update dispatched' })
  @ApiResponse({ status: 400, description: 'Invalid presence state' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async updatePresence(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePresenceDto,
  ) {
    await this.instancesService.findOne(tenant.id, id);

    await this.lifecycleQueue.add('update-presence', {
      instanceId: id,
      tenantId: tenant.id,
      presence: dto.presence,
      jid: dto.jid,
    });

    return { message: 'Presence update dispatched' };
  }
}

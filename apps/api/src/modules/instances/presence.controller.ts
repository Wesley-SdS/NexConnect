import { Body, Controller, Param, Patch } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { InstancesService } from './instances.service';

class UpdatePresenceDto {
  presence!: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused';
  jid?: string;
}

@Controller('instances')
export class PresenceController {
  constructor(
    private readonly instancesService: InstancesService,
    @InjectQueue('instance-lifecycle')
    private readonly lifecycleQueue: Queue,
  ) {}

  @Patch(':id/presence')
  @RequiredScopes('send')
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

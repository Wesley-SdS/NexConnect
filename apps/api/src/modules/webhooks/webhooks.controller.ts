import { Body, Controller, Post } from '@nestjs/common';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { WebhooksService } from './webhooks.service';

class ReplayEventDto {
  eventId!: string;
  webhookId!: string;
}

@Controller('events')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('replay')
  @RequiredScopes('admin')
  replay(
    @CurrentTenant() tenant: { id: string },
    @Body() dto: ReplayEventDto,
  ) {
    return this.webhooksService.replayEvent(tenant.id, dto.eventId, dto.webhookId);
  }
}

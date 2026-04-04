import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { ChannelsService } from './channels.service';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';

@ApiTags('Channels')
@ApiBearerAuth()
@Controller('instances/:instanceId/channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Post('publish')
  @RequiredScopes('send')
  @ApiOperation({ summary: 'Publish to channel', description: 'Publishes content to a WhatsApp channel (newsletter) linked to the instance' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiResponse({ status: 201, description: 'Content published successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  publish(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body() dto: { content: Record<string, unknown> },
  ) {
    return this.channelsService.publish(tenant.id, instanceId, dto);
  }

  @Get()
  @RequiredScopes('read')
  @ApiOperation({ summary: 'List channels', description: 'Lists all WhatsApp channels (newsletters) available for the instance' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiResponse({ status: 200, description: 'Channels retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  listChannels(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
  ) {
    return this.channelsService.listChannels(tenant.id, instanceId);
  }
}

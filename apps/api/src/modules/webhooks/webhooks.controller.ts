import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsISO8601 } from 'class-validator';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { WebhooksService } from './webhooks.service';
import { WebhookEvent } from '@nexconnect/core';

export class ReplayEventsDto {
  @ApiProperty({ description: 'Start of the time range (ISO 8601)', example: '2026-03-01T00:00:00Z' })
  @IsISO8601()
  from!: string;

  @ApiProperty({ description: 'End of the time range (ISO 8601)', example: '2026-03-30T23:59:59Z' })
  @IsISO8601()
  to!: string;

  @ApiProperty({ description: 'Filter by specific event types', example: ['message.received', 'message.sent'], required: false })
  @IsOptional()
  @IsArray()
  eventTypes?: WebhookEvent[];

  @ApiProperty({ description: 'Filter by instance ID', example: 'uuid-instance', required: false })
  @IsOptional()
  @IsString()
  instanceId?: string;

  @ApiProperty({ description: 'Override target URL for replayed events', example: 'https://api.example.com/webhook', required: false })
  @IsOptional()
  @IsString()
  targetUrl?: string;
}

@ApiTags('Events')
@ApiBearerAuth()
@Controller('events')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('replay')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Replay events', description: 'Re-delivers webhook events from a specified time range to the target endpoint' })
  @ApiBody({ type: ReplayEventsDto })
  @ApiResponse({ status: 200, description: 'Event replay dispatched' })
  @ApiResponse({ status: 400, description: 'Invalid request body or date range' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'No events found in the specified range' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  replay(
    @CurrentTenant() tenant: { id: string },
    @Body() dto: ReplayEventsDto,
  ) {
    return this.webhooksService.replayEvents(tenant.id, dto);
  }
}

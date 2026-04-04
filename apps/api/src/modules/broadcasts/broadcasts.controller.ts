import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiBody, ApiQuery, ApiProperty } from '@nestjs/swagger';
import { BroadcastsService, BroadcastVariant } from './broadcasts.service';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';

class SendWindowDto {
  @ApiProperty({ description: 'Start hour (0-23)', example: 8 })
  start!: number;

  @ApiProperty({ description: 'End hour (0-23)', example: 18 })
  end!: number;

  @ApiProperty({ description: 'IANA timezone', example: 'America/Sao_Paulo' })
  timezone!: string;
}

class CreateBroadcastDto {
  @ApiProperty({ description: 'Instance IDs to send from', example: ['uuid-1', 'uuid-2'] })
  instanceIds!: string[];

  @ApiProperty({ description: 'Recipient phone numbers', example: ['5511999999999'] })
  recipients!: string[];

  @ApiProperty({ description: 'Message type', example: 'text' })
  type!: string;

  @ApiProperty({ description: 'Message content payload', example: { text: 'Hello!' } })
  content!: Record<string, any>;

  @ApiProperty({ description: 'Delay between messages in ms', example: 2000, required: false })
  delayBetweenMs?: number;

  @ApiProperty({ description: 'A/B test message variants', required: false })
  variants?: BroadcastVariant[];

  @ApiProperty({ description: 'Time window for sending', required: false, type: SendWindowDto })
  sendWindow?: { start: number; end: number; timezone: string };
}

class UpdateBroadcastStatusDto {
  @ApiProperty({ description: 'New broadcast status', enum: ['paused', 'active'], example: 'paused' })
  status!: 'paused' | 'active';
}

@ApiTags('Broadcasts')
@ApiBearerAuth()
@Controller('broadcasts')
export class BroadcastsController {
  constructor(private readonly broadcastsService: BroadcastsService) {}

  @Post()
  @RequiredScopes('send')
  @ApiOperation({ summary: 'Create broadcast', description: 'Creates a new broadcast campaign to send messages to multiple recipients' })
  @ApiBody({ type: CreateBroadcastDto })
  @ApiResponse({ status: 201, description: 'Broadcast created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 422, description: 'Validation error' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  create(
    @CurrentTenant() tenant: { id: string },
    @Body() dto: CreateBroadcastDto,
  ) {
    return this.broadcastsService.create(tenant.id, dto);
  }

  @Get()
  @RequiredScopes('read')
  @ApiOperation({ summary: 'List broadcasts', description: 'Returns paginated list of broadcast campaigns for the current tenant' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: 20 })
  @ApiResponse({ status: 200, description: 'Broadcasts retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  findAll(
    @CurrentTenant() tenant: { id: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.broadcastsService.findAll(tenant.id, page ?? 1, limit ?? 20);
  }

  @Get(':id')
  @RequiredScopes('read')
  @ApiOperation({ summary: 'Get broadcast by ID', description: 'Returns details and delivery stats for a specific broadcast' })
  @ApiParam({ name: 'id', description: 'Broadcast UUID' })
  @ApiResponse({ status: 200, description: 'Broadcast retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Broadcast not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  findOne(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.broadcastsService.findOne(tenant.id, id);
  }

  @Patch(':id/status')
  @RequiredScopes('send')
  @ApiOperation({ summary: 'Update broadcast status', description: 'Pauses or resumes an active broadcast campaign' })
  @ApiParam({ name: 'id', description: 'Broadcast UUID' })
  @ApiBody({ type: UpdateBroadcastStatusDto })
  @ApiResponse({ status: 200, description: 'Broadcast status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status value' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Broadcast not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  updateStatus(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBroadcastStatusDto,
  ) {
    return this.broadcastsService.updateStatus(tenant.id, id, dto.status);
  }
}

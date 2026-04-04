import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiBody, ApiQuery, ApiProperty } from '@nestjs/swagger';
import { SchedulingService } from './scheduling.service';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';

class CreateScheduledMessageDto {
  @ApiProperty({ description: 'Instance ID to send from', example: 'uuid-instance' })
  instanceId!: string;

  @ApiProperty({ description: 'Recipient phone number', example: '5511999999999' })
  to!: string;

  @ApiProperty({ description: 'Message type', example: 'text' })
  type!: string;

  @ApiProperty({ description: 'Message content payload', example: { text: 'Scheduled reminder!' } })
  content!: Record<string, any>;

  @ApiProperty({ description: 'When to send (ISO 8601)', example: '2026-04-01T10:00:00Z' })
  scheduledAt!: string;
}

class CreateCronJobDto {
  @ApiProperty({ description: 'Instance ID to send from', example: 'uuid-instance' })
  instanceId!: string;

  @ApiProperty({ description: 'Cron job display name', example: 'Daily greeting' })
  name!: string;

  @ApiProperty({ description: 'Cron expression', example: '0 9 * * *' })
  cronExpression!: string;

  @ApiProperty({ description: 'Recipient phone number', example: '5511999999999' })
  to!: string;

  @ApiProperty({ description: 'Message type', example: 'text' })
  type!: string;

  @ApiProperty({ description: 'Message content payload', example: { text: 'Good morning!' } })
  content!: Record<string, any>;
}

class UpdateScheduledMessageDto {
  @ApiProperty({ description: 'New scheduled time (ISO 8601)', example: '2026-04-02T10:00:00Z', required: false })
  scheduledAt?: string;

  @ApiProperty({ description: 'Updated message content', example: { text: 'Updated reminder!' }, required: false })
  content?: Record<string, any>;

  @ApiProperty({ description: 'Whether the scheduled message is active', example: true, required: false })
  active?: boolean;
}

@ApiTags('Scheduling')
@ApiBearerAuth()
@Controller('scheduling')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Post('messages')
  @RequiredScopes('send')
  @ApiOperation({ summary: 'Schedule message', description: 'Schedules a message to be sent at a specific future time' })
  @ApiBody({ type: CreateScheduledMessageDto })
  @ApiResponse({ status: 201, description: 'Message scheduled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 422, description: 'Scheduled time is in the past' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  createScheduledMessage(
    @CurrentTenant() tenant: { id: string },
    @Body() dto: CreateScheduledMessageDto,
  ) {
    return this.schedulingService.createScheduledMessage(tenant.id, dto);
  }

  @Get('messages')
  @RequiredScopes('read')
  @ApiOperation({ summary: 'List scheduled messages', description: 'Returns all scheduled messages, optionally filtered by instance' })
  @ApiQuery({ name: 'instanceId', required: false, description: 'Filter by instance UUID' })
  @ApiResponse({ status: 200, description: 'Scheduled messages retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  findAllScheduledMessages(
    @CurrentTenant() tenant: { id: string },
    @Query('instanceId') instanceId?: string,
  ) {
    return this.schedulingService.findAllScheduledMessages(tenant.id, instanceId);
  }

  @Get('messages/:id')
  @RequiredScopes('read')
  @ApiOperation({ summary: 'Get scheduled message', description: 'Returns details for a specific scheduled message' })
  @ApiParam({ name: 'id', description: 'Scheduled message UUID' })
  @ApiResponse({ status: 200, description: 'Scheduled message retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Scheduled message not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  findOneScheduledMessage(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.schedulingService.findOneScheduledMessage(tenant.id, id);
  }

  @Patch('messages/:id')
  @RequiredScopes('send')
  @ApiOperation({ summary: 'Update scheduled message', description: 'Updates the content, time or active state of a scheduled message' })
  @ApiParam({ name: 'id', description: 'Scheduled message UUID' })
  @ApiBody({ type: UpdateScheduledMessageDto })
  @ApiResponse({ status: 200, description: 'Scheduled message updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Scheduled message not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  updateScheduledMessage(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduledMessageDto,
  ) {
    return this.schedulingService.updateScheduledMessage(tenant.id, id, dto);
  }

  @Delete('messages/:id')
  @RequiredScopes('send')
  @ApiOperation({ summary: 'Delete scheduled message', description: 'Cancels and removes a scheduled message' })
  @ApiParam({ name: 'id', description: 'Scheduled message UUID' })
  @ApiResponse({ status: 200, description: 'Scheduled message deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Scheduled message not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  deleteScheduledMessage(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.schedulingService.deleteScheduledMessage(tenant.id, id);
  }

  @Post('cron-jobs')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Create cron job', description: 'Creates a recurring scheduled message using a cron expression' })
  @ApiBody({ type: CreateCronJobDto })
  @ApiResponse({ status: 201, description: 'Cron job created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid cron expression or request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 422, description: 'Validation error' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  createCronJob(
    @CurrentTenant() tenant: { id: string },
    @Body() dto: CreateCronJobDto,
  ) {
    return this.schedulingService.createCronJob(tenant.id, dto);
  }

  @Get('cron-jobs')
  @RequiredScopes('read')
  @ApiOperation({ summary: 'List cron jobs', description: 'Returns all cron jobs, optionally filtered by instance' })
  @ApiQuery({ name: 'instanceId', required: false, description: 'Filter by instance UUID' })
  @ApiResponse({ status: 200, description: 'Cron jobs retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  findAllCronJobs(
    @CurrentTenant() tenant: { id: string },
    @Query('instanceId') instanceId?: string,
  ) {
    return this.schedulingService.findAllCronJobs(tenant.id, instanceId);
  }

  @Delete('cron-jobs/:id')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Delete cron job', description: 'Permanently removes a recurring cron job' })
  @ApiParam({ name: 'id', description: 'Cron job UUID' })
  @ApiResponse({ status: 200, description: 'Cron job deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Cron job not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  deleteCronJob(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.schedulingService.deleteCronJob(tenant.id, id);
  }
}

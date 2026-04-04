import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { SendMessageDto } from '@nexconnect/core';

@ApiTags('Messages')
@ApiBearerAuth()
@Controller('instances/:instanceId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @RequiredScopes('send')
  @ApiOperation({ summary: 'Send message', description: 'Sends a WhatsApp message (text, image, video, document, etc.) through the instance' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({ status: 201, description: 'Message queued for sending' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 422, description: 'Validation error' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  send(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.send(tenant.id, instanceId, dto);
  }

  @Get()
  @RequiredScopes('read')
  @ApiOperation({ summary: 'List messages', description: 'Returns paginated message history for the instance, filterable by direction and status' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: 50 })
  @ApiQuery({ name: 'direction', required: false, description: 'Filter by direction (INBOUND or OUTBOUND)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by message status' })
  @ApiResponse({ status: 200, description: 'Messages retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  findAll(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('direction') direction?: string,
    @Query('status') status?: string,
  ) {
    return this.messagesService.findAll(tenant.id, instanceId, {
      page: page ?? 1,
      limit: limit ?? 50,
      direction,
      status,
    });
  }

  @Get(':msgId')
  @RequiredScopes('read')
  @ApiOperation({ summary: 'Get message by ID', description: 'Returns detailed information about a specific message including delivery status' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiParam({ name: 'msgId', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Message or instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  findOne(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('msgId') msgId: string,
  ) {
    return this.messagesService.findOne(tenant.id, instanceId, msgId);
  }
}

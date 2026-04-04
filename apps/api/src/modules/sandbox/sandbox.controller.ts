import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiBody, ApiProperty } from '@nestjs/swagger';
import { SandboxService } from './sandbox.service';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';

class CreateSandboxInstanceDto {
  @ApiProperty({ description: 'Sandbox instance name', example: 'Test Instance' })
  name!: string;

  @ApiProperty({ description: 'Optional instance settings', example: { autoReconnect: false }, required: false })
  settings?: Record<string, any>;
}

class SimulateInboundDto {
  @ApiProperty({ description: 'Sandbox session ID', example: 'uuid-session' })
  sessionId!: string;

  @ApiProperty({ description: 'Sender phone number', example: '5511999999999' })
  from!: string;

  @ApiProperty({ description: 'Message type', example: 'text' })
  type!: string;

  @ApiProperty({ description: 'Message content', example: { text: 'Hello!' } })
  content!: Record<string, any>;
}

class SimulateWebhookDto {
  @ApiProperty({ description: 'Sandbox session ID', example: 'uuid-session' })
  sessionId!: string;

  @ApiProperty({ description: 'Event name to simulate', example: 'message.received' })
  event!: string;

  @ApiProperty({ description: 'Event payload data', example: { messageId: 'msg_123' }, required: false })
  data?: Record<string, any>;
}

@ApiTags('Sandbox')
@ApiBearerAuth()
@Controller('sandbox')
export class SandboxController {
  constructor(private readonly sandboxService: SandboxService) {}

  @Post('instances')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Create sandbox instance', description: 'Creates a simulated WhatsApp instance for testing without a real phone' })
  @ApiBody({ type: CreateSandboxInstanceDto })
  @ApiResponse({ status: 201, description: 'Sandbox instance created' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  createInstance(
    @CurrentTenant() tenant: { id: string },
    @Body() dto: CreateSandboxInstanceDto,
  ) {
    return this.sandboxService.createInstance(tenant.id, dto);
  }

  @Post('simulate/inbound')
  @RequiredScopes('send')
  @ApiOperation({ summary: 'Simulate inbound message', description: 'Simulates receiving a WhatsApp message in the sandbox environment' })
  @ApiBody({ type: SimulateInboundDto })
  @ApiResponse({ status: 200, description: 'Inbound message simulated' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  simulateInbound(
    @CurrentTenant() tenant: { id: string },
    @Body() dto: SimulateInboundDto,
  ) {
    return this.sandboxService.simulateInbound(tenant.id, dto);
  }

  @Post('simulate/webhook')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Simulate webhook event', description: 'Simulates a webhook event delivery in the sandbox environment' })
  @ApiBody({ type: SimulateWebhookDto })
  @ApiResponse({ status: 200, description: 'Webhook event simulated' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  simulateWebhook(
    @CurrentTenant() tenant: { id: string },
    @Body() dto: SimulateWebhookDto,
  ) {
    return this.sandboxService.simulateWebhook(tenant.id, dto);
  }

  @Get('sessions')
  @RequiredScopes('read')
  @ApiOperation({ summary: 'List sandbox sessions', description: 'Returns all active sandbox sessions for the tenant' })
  @ApiResponse({ status: 200, description: 'Sessions retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  listSessions(@CurrentTenant() tenant: { id: string }) {
    return this.sandboxService.listSessions(tenant.id);
  }

  @Delete('sessions/:id')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Delete sandbox session', description: 'Terminates and removes a sandbox session' })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  @ApiResponse({ status: 200, description: 'Session deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  deleteSession(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sandboxService.deleteSession(tenant.id, id);
  }
}

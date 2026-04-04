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
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { InstancesService } from './instances.service';
import { InstanceLifecycleService } from './instance-lifecycle.service';
import { InstanceMetricsService } from './instance-metrics.service';
import type { QrCodeResult } from './qrcode.service';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import {
  CreateInstanceDto,
  UpdateInstanceDto,
  UpdateProfileDto,
  CreateWebhookDto,
  UpdateWebhookDto,
} from '@nexconnect/core';
import { WebhooksService } from '../webhooks/webhooks.service';

@ApiTags('Instances')
@ApiBearerAuth()
@Controller('instances')
export class InstancesController {
  constructor(
    private readonly instancesService: InstancesService,
    private readonly lifecycleService: InstanceLifecycleService,
    private readonly metricsService: InstanceMetricsService,
    private readonly webhooksService: WebhooksService,
  ) {}

  @Post()
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Create instance', description: 'Creates a new WhatsApp instance for the tenant' })
  @ApiBody({ type: CreateInstanceDto })
  @ApiResponse({ status: 201, description: 'Instance created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 422, description: 'Validation error' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  create(
    @CurrentTenant() tenant: { id: string },
    @Body() dto: CreateInstanceDto,
  ) {
    return this.instancesService.create(tenant.id, dto);
  }

  @Get()
  @RequiredScopes('read')
  @ApiOperation({ summary: 'List instances', description: 'Returns all WhatsApp instances for the tenant' })
  @ApiResponse({ status: 200, description: 'Instances retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  findAll(@CurrentTenant() tenant: { id: string }) {
    return this.instancesService.findAll(tenant.id);
  }

  @Get(':id')
  @RequiredScopes('read')
  @ApiOperation({ summary: 'Get instance by ID', description: 'Returns detailed information about a specific instance' })
  @ApiParam({ name: 'id', description: 'Instance UUID' })
  @ApiResponse({ status: 200, description: 'Instance retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  findOne(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.instancesService.findOne(tenant.id, id);
  }

  @Patch(':id')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Update instance', description: 'Updates instance name, connection type or settings' })
  @ApiParam({ name: 'id', description: 'Instance UUID' })
  @ApiBody({ type: UpdateInstanceDto })
  @ApiResponse({ status: 200, description: 'Instance updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  update(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInstanceDto,
  ) {
    return this.instancesService.update(tenant.id, id, dto);
  }

  @Delete(':id')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Delete instance', description: 'Permanently removes an instance and all its associated data' })
  @ApiParam({ name: 'id', description: 'Instance UUID' })
  @ApiResponse({ status: 200, description: 'Instance deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  remove(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.instancesService.remove(tenant.id, id);
  }

  @Get(':id/qrcode')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Get QR code', description: 'Retrieves the current QR code for WhatsApp Web authentication' })
  @ApiParam({ name: 'id', description: 'Instance UUID' })
  @ApiResponse({ status: 200, description: 'QR code retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  getQrCode(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<QrCodeResult> {
    return this.instancesService.getQrCode(tenant.id, id);
  }

  @Post(':id/pairing-code')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Get pairing code', description: 'Generates a pairing code for phone-based WhatsApp authentication' })
  @ApiParam({ name: 'id', description: 'Instance UUID' })
  @ApiResponse({ status: 200, description: 'Pairing code generated successfully' })
  @ApiResponse({ status: 400, description: 'Missing phone number' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  getPairingCode(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body('phoneNumber') phoneNumber: string,
  ) {
    return this.lifecycleService.getPairingCode(tenant.id, id, phoneNumber);
  }

  @Post(':id/power-on')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Power on instance', description: 'Starts the WhatsApp connection for this instance' })
  @ApiParam({ name: 'id', description: 'Instance UUID' })
  @ApiResponse({ status: 200, description: 'Instance power-on requested' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  powerOn(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.lifecycleService.powerOn(tenant.id, id);
  }

  @Post(':id/power-off')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Power off instance', description: 'Disconnects the WhatsApp session for this instance' })
  @ApiParam({ name: 'id', description: 'Instance UUID' })
  @ApiResponse({ status: 200, description: 'Instance power-off requested' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  powerOff(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.lifecycleService.powerOff(tenant.id, id);
  }

  @Post(':id/restart')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Restart instance', description: 'Disconnects and reconnects the WhatsApp session' })
  @ApiParam({ name: 'id', description: 'Instance UUID' })
  @ApiResponse({ status: 200, description: 'Instance restart requested' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  restart(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.lifecycleService.restart(tenant.id, id);
  }

  @Patch(':id/profile')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Update profile', description: 'Updates the WhatsApp profile (name, status, picture) for the instance' })
  @ApiParam({ name: 'id', description: 'Instance UUID' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: 200, description: 'Profile update requested' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  updateProfile(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.lifecycleService.updateProfile(tenant.id, id, dto);
  }

  @Get(':id/health')
  @RequiredScopes('read')
  @ApiOperation({ summary: 'Get instance health', description: 'Returns health and connectivity status for the instance' })
  @ApiParam({ name: 'id', description: 'Instance UUID' })
  @ApiResponse({ status: 200, description: 'Instance health retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  getHealth(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.metricsService.getHealth(tenant.id, id);
  }

  @Get(':id/metrics')
  @RequiredScopes('read')
  @ApiOperation({ summary: 'Get instance metrics', description: 'Returns message volume and performance metrics for the instance' })
  @ApiParam({ name: 'id', description: 'Instance UUID' })
  @ApiQuery({ name: 'period', required: false, description: 'Time period (e.g. 24h, 7d, 30d)' })
  @ApiResponse({ status: 200, description: 'Instance metrics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  getMetrics(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Query('period') period?: string,
  ) {
    return this.metricsService.getMetrics(tenant.id, id, period);
  }

  @Post(':id/webhooks')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Create webhook', description: 'Registers a new webhook endpoint for instance events' })
  @ApiParam({ name: 'id', description: 'Instance UUID' })
  @ApiBody({ type: CreateWebhookDto })
  @ApiResponse({ status: 201, description: 'Webhook created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async createWebhook(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateWebhookDto,
  ) {
    await this.instancesService.findOne(tenant.id, id);
    return this.webhooksService.create(id, {
      tenantId: tenant.id,
      name: dto.name,
      url: dto.url,
      events: dto.events,
      secret: dto.secret,
    });
  }

  @Patch(':id/webhooks/:wid')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Update webhook', description: 'Updates an existing webhook configuration' })
  @ApiParam({ name: 'id', description: 'Instance UUID' })
  @ApiParam({ name: 'wid', description: 'Webhook UUID' })
  @ApiBody({ type: UpdateWebhookDto })
  @ApiResponse({ status: 200, description: 'Webhook updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Webhook or instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async updateWebhook(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('wid', ParseUUIDPipe) wid: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    await this.instancesService.findOne(tenant.id, id);
    return this.webhooksService.update(wid, dto);
  }

  @Delete(':id/webhooks/:wid')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Delete webhook', description: 'Permanently removes a webhook endpoint' })
  @ApiParam({ name: 'id', description: 'Instance UUID' })
  @ApiParam({ name: 'wid', description: 'Webhook UUID' })
  @ApiResponse({ status: 200, description: 'Webhook deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Webhook or instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async deleteWebhook(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('wid', ParseUUIDPipe) wid: string,
  ) {
    await this.instancesService.findOne(tenant.id, id);
    return this.webhooksService.remove(wid);
  }

  @Post(':id/webhooks/:wid/test')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Test webhook', description: 'Sends a test payload to the webhook endpoint to verify connectivity' })
  @ApiParam({ name: 'id', description: 'Instance UUID' })
  @ApiParam({ name: 'wid', description: 'Webhook UUID' })
  @ApiResponse({ status: 200, description: 'Test payload sent successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Webhook or instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async testWebhook(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('wid', ParseUUIDPipe) wid: string,
  ) {
    await this.instancesService.findOne(tenant.id, id);
    return this.webhooksService.testDispatch(wid);
  }
}

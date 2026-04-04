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
import { InstancesService } from './instances.service';
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

@Controller('instances')
export class InstancesController {
  constructor(private readonly instancesService: InstancesService) {}

  @Post()
  @RequiredScopes('admin')
  create(
    @CurrentTenant() tenant: { id: string },
    @Body() dto: CreateInstanceDto,
  ) {
    return this.instancesService.create(tenant.id, dto);
  }

  @Get()
  @RequiredScopes('read')
  findAll(@CurrentTenant() tenant: { id: string }) {
    return this.instancesService.findAll(tenant.id);
  }

  @Get(':id')
  @RequiredScopes('read')
  findOne(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.instancesService.findOne(tenant.id, id);
  }

  @Patch(':id')
  @RequiredScopes('admin')
  update(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInstanceDto,
  ) {
    return this.instancesService.update(tenant.id, id, dto);
  }

  @Delete(':id')
  @RequiredScopes('admin')
  remove(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.instancesService.remove(tenant.id, id);
  }

  @Get(':id/qrcode')
  @RequiredScopes('admin')
  getQrCode(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.instancesService.getQrCode(tenant.id, id);
  }

  @Post(':id/pairing-code')
  @RequiredScopes('admin')
  getPairingCode(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body('phoneNumber') phoneNumber: string,
  ) {
    return this.instancesService.getPairingCode(tenant.id, id, phoneNumber);
  }

  @Post(':id/power-on')
  @RequiredScopes('admin')
  powerOn(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.instancesService.powerOn(tenant.id, id);
  }

  @Post(':id/power-off')
  @RequiredScopes('admin')
  powerOff(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.instancesService.powerOff(tenant.id, id);
  }

  @Post(':id/restart')
  @RequiredScopes('admin')
  restart(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.instancesService.restart(tenant.id, id);
  }

  @Patch(':id/profile')
  @RequiredScopes('admin')
  updateProfile(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.instancesService.updateProfile(tenant.id, id, dto);
  }

  @Get(':id/health')
  @RequiredScopes('read')
  getHealth(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.instancesService.getHealth(tenant.id, id);
  }

  @Get(':id/metrics')
  @RequiredScopes('read')
  getMetrics(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Query('period') period?: string,
  ) {
    return this.instancesService.getMetrics(tenant.id, id, period);
  }

  @Post(':id/webhooks')
  @RequiredScopes('admin')
  createWebhook(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.instancesService.createWebhook(tenant.id, id, dto);
  }

  @Patch(':id/webhooks/:wid')
  @RequiredScopes('admin')
  updateWebhook(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('wid', ParseUUIDPipe) wid: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.instancesService.updateWebhook(tenant.id, id, wid, dto);
  }

  @Delete(':id/webhooks/:wid')
  @RequiredScopes('admin')
  deleteWebhook(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('wid', ParseUUIDPipe) wid: string,
  ) {
    return this.instancesService.deleteWebhook(tenant.id, id, wid);
  }

  @Post(':id/webhooks/:wid/test')
  @RequiredScopes('admin')
  testWebhook(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('wid', ParseUUIDPipe) wid: string,
  ) {
    return this.instancesService.testWebhook(tenant.id, id, wid);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { CreateTenantDto, UpdateTenantDto } from '@nexconnect/core';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
@RequiredScopes('admin')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @ApiOperation({ summary: 'Create tenant', description: 'Registers a new tenant (organization) in the platform' })
  @ApiBody({ type: CreateTenantDto })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 409, description: 'Tenant with this name already exists' })
  @ApiResponse({ status: 422, description: 'Validation error' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List tenants', description: 'Returns all active tenants in the platform' })
  @ApiResponse({ status: 200, description: 'Tenants retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  findAll(@CurrentTenant() _tenant: { id: string }) {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant by ID', description: 'Returns detailed information about a specific tenant' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Tenant retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update tenant', description: 'Updates tenant name, plan or contact email' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiBody({ type: UpdateTenantDto })
  @ApiResponse({ status: 200, description: 'Tenant updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete tenant', description: 'Soft-deletes a tenant and all associated resources' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Tenant deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.remove(id);
  }

  @Get(':id/data/export')
  @ApiOperation({ summary: 'Export tenant data', description: 'Exports all tenant data for LGPD/GDPR compliance' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Tenant data exported successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  exportData(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.exportData(id);
  }

  @Delete(':id/data')
  @ApiOperation({ summary: 'Delete personal data', description: 'Permanently removes all personal data for LGPD/GDPR right-to-erasure compliance' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Personal data deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  deleteData(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.deletePersonalData(id);
  }
}

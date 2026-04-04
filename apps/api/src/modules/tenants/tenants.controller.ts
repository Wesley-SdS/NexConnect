import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { CreateTenantDto, UpdateTenantDto } from '@nexconnect/core';

@Controller('tenants')
@RequiredScopes('admin')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get()
  findAll(@CurrentTenant() tenant: { id: string }) {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.remove(id);
  }

  @Get(':id/data/export')
  exportData(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.exportData(id);
  }

  @Delete(':id/data')
  deleteData(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.deletePersonalData(id);
  }
}

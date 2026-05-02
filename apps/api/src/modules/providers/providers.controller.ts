import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProviderCredentialData } from '@nexconnect/core';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import {
  CreateCredentialDto,
  ListCredentialsQueryDto,
  UpdateCredentialDto,
} from './dto/credential.dto';
import { ProviderCredentialService } from './provider-credential.service';

@ApiTags('Providers')
@ApiBearerAuth()
@Controller('providers/credentials')
export class ProvidersController {
  constructor(private readonly service: ProviderCredentialService) {}

  @Post()
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Register provider credentials (Meta / Twilio)' })
  @ApiResponse({ status: 201, description: 'Credentials registered' })
  @ApiResponse({ status: 400, description: 'Invalid credential payload' })
  async create(
    @CurrentTenant() tenant: { id: string },
    @Body() dto: CreateCredentialDto,
  ) {
    return this.service.create({
      tenantId: tenant.id,
      instanceId: dto.instanceId,
      provider: dto.provider,
      displayName: dto.displayName,
      credentials: { ...dto.credentials, type: dto.provider } as unknown as ProviderCredentialData,
      webhookCallbackUrl: dto.webhookCallbackUrl,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      metadata: dto.metadata,
    });
  }

  @Get()
  @RequiredScopes('admin', 'read')
  @ApiOperation({ summary: 'List provider credentials' })
  async list(
    @CurrentTenant() tenant: { id: string },
    @Query() query: ListCredentialsQueryDto,
  ) {
    return this.service.list(tenant.id, query);
  }

  @Get(':id')
  @RequiredScopes('admin', 'read')
  @ApiOperation({ summary: 'Get a provider credential by id' })
  async findOne(
    @CurrentTenant() tenant: { id: string },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findById(tenant.id, id);
  }

  @Patch(':id')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Update / rotate provider credentials' })
  async update(
    @CurrentTenant() _tenant: { id: string },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCredentialDto,
  ) {
    return this.service.update(id, {
      displayName: dto.displayName,
      credentials: dto.credentials as unknown as ProviderCredentialData | undefined,
      webhookCallbackUrl: dto.webhookCallbackUrl,
      status: dto.status,
      metadata: dto.metadata,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });
  }

  @Delete(':id')
  @RequiredScopes('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a provider credential' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.service.delete(id);
  }
}

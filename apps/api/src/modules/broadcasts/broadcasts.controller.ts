import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { BroadcastsService } from './broadcasts.service';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';

class CreateBroadcastDto {
  instanceIds!: string[];
  recipients!: string[];
  type!: string;
  content!: Record<string, any>;
  delayBetweenMs?: number;
}

@Controller('broadcasts')
export class BroadcastsController {
  constructor(private readonly broadcastsService: BroadcastsService) {}

  @Post()
  @RequiredScopes('send')
  create(
    @CurrentTenant() tenant: { id: string },
    @Body() dto: CreateBroadcastDto,
  ) {
    return this.broadcastsService.create(tenant.id, dto);
  }

  @Get()
  @RequiredScopes('read')
  findAll(
    @CurrentTenant() tenant: { id: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.broadcastsService.findAll(tenant.id, page ?? 1, limit ?? 20);
  }

  @Get(':id')
  @RequiredScopes('read')
  findOne(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.broadcastsService.findOne(tenant.id, id);
  }
}

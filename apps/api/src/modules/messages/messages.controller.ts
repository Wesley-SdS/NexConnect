import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { SendMessageDto } from '@nexconnect/core';

@Controller('instances/:instanceId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @RequiredScopes('send')
  send(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.send(tenant.id, instanceId, dto);
  }

  @Get()
  @RequiredScopes('read')
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
  findOne(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('msgId') msgId: string,
  ) {
    return this.messagesService.findOne(tenant.id, instanceId, msgId);
  }
}

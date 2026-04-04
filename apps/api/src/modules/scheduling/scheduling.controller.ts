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
import { SchedulingService } from './scheduling.service';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';

class CreateScheduledMessageDto {
  instanceId!: string;
  to!: string;
  type!: string;
  content!: Record<string, any>;
  scheduledAt!: string;
}

class CreateCronJobDto {
  instanceId!: string;
  name!: string;
  cronExpression!: string;
  to!: string;
  type!: string;
  content!: Record<string, any>;
}

class UpdateScheduledMessageDto {
  scheduledAt?: string;
  content?: Record<string, any>;
  active?: boolean;
}

@Controller('scheduling')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Post('messages')
  @RequiredScopes('send')
  createScheduledMessage(
    @CurrentTenant() tenant: { id: string },
    @Body() dto: CreateScheduledMessageDto,
  ) {
    return this.schedulingService.createScheduledMessage(tenant.id, dto);
  }

  @Get('messages')
  @RequiredScopes('read')
  findAllScheduledMessages(
    @CurrentTenant() tenant: { id: string },
    @Query('instanceId') instanceId?: string,
  ) {
    return this.schedulingService.findAllScheduledMessages(tenant.id, instanceId);
  }

  @Get('messages/:id')
  @RequiredScopes('read')
  findOneScheduledMessage(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.schedulingService.findOneScheduledMessage(tenant.id, id);
  }

  @Patch('messages/:id')
  @RequiredScopes('send')
  updateScheduledMessage(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduledMessageDto,
  ) {
    return this.schedulingService.updateScheduledMessage(tenant.id, id, dto);
  }

  @Delete('messages/:id')
  @RequiredScopes('send')
  deleteScheduledMessage(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.schedulingService.deleteScheduledMessage(tenant.id, id);
  }

  @Post('cron-jobs')
  @RequiredScopes('admin')
  createCronJob(
    @CurrentTenant() tenant: { id: string },
    @Body() dto: CreateCronJobDto,
  ) {
    return this.schedulingService.createCronJob(tenant.id, dto);
  }

  @Get('cron-jobs')
  @RequiredScopes('read')
  findAllCronJobs(
    @CurrentTenant() tenant: { id: string },
    @Query('instanceId') instanceId?: string,
  ) {
    return this.schedulingService.findAllCronJobs(tenant.id, instanceId);
  }

  @Delete('cron-jobs/:id')
  @RequiredScopes('admin')
  deleteCronJob(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.schedulingService.deleteCronJob(tenant.id, id);
  }
}

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { Public } from '../../../common/decorators/public.decorator';
import { SlackSignatureGuard } from './slack-signature.guard';
import { SlackWebhookService } from './slack-webhook.service';
import { SlackSlashCommandPayload } from '../types/slack.types';

@ApiTags('Webhooks')
@ApiExcludeController()
@Controller('webhooks/slack')
export class SlackCommandsController {
  constructor(private readonly service: SlackWebhookService) {}

  @Public()
  @Post(':credentialId/commands')
  @UseGuards(SlackSignatureGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Slack slash commands receiver' })
  async commands(
    @Param('credentialId', new ParseUUIDPipe()) credentialId: string,
    @Body() payload: SlackSlashCommandPayload,
    @Req() request: FastifyRequest,
  ) {
    return this.service.handleSlashCommand(
      credentialId,
      payload,
      request.headers as Record<string, string | string[] | undefined>,
    );
  }
}

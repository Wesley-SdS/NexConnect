import {
  Body,
  Controller,
  Headers,
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
import { SlackEventCallback } from '../types/slack.types';

@ApiTags('Webhooks')
@ApiExcludeController()
@Controller('webhooks/slack')
export class SlackEventsController {
  constructor(private readonly service: SlackWebhookService) {}

  @Public()
  @Post(':credentialId/events')
  @UseGuards(SlackSignatureGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Slack Events API receiver' })
  async events(
    @Param('credentialId', new ParseUUIDPipe()) credentialId: string,
    @Body() envelope: SlackEventCallback,
    @Req() request: FastifyRequest,
  ): Promise<{ ok: true; challenge?: string }> {
    return this.service.handleEvent(
      credentialId,
      envelope,
      request.headers as Record<string, string | string[] | undefined>,
    );
  }
}

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
import { SlackInteractivityPayload } from '../types/slack.types';

/**
 * Slack interactivity & shortcuts endpoint. Body arrives as
 * `application/x-www-form-urlencoded` with a single `payload` field
 * holding URL-encoded JSON. The Fastify content-type parser registered
 * in main.ts already takes care of preserving the raw body for the
 * signature guard.
 */
@ApiTags('Webhooks')
@ApiExcludeController()
@Controller('webhooks/slack')
export class SlackInteractivityController {
  constructor(private readonly service: SlackWebhookService) {}

  @Public()
  @Post(':credentialId/interactivity')
  @UseGuards(SlackSignatureGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Slack interactivity (block_actions, view_submission, shortcuts)' })
  async interactivity(
    @Param('credentialId', new ParseUUIDPipe()) credentialId: string,
    @Body() body: { payload?: string } | SlackInteractivityPayload,
    @Req() request: FastifyRequest,
  ): Promise<{ ok: true }> {
    const payload = this.extractPayload(body);
    return this.service.handleInteractivity(
      credentialId,
      payload,
      request.headers as Record<string, string | string[] | undefined>,
    );
  }

  private extractPayload(
    body: { payload?: string } | SlackInteractivityPayload,
  ): SlackInteractivityPayload {
    if (body && typeof body === 'object' && 'payload' in body && typeof body.payload === 'string') {
      return JSON.parse(body.payload) as SlackInteractivityPayload;
    }
    return body as SlackInteractivityPayload;
  }
}

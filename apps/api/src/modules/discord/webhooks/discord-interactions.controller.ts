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
import { DiscordEd25519Guard } from './discord-ed25519.guard';
import { DiscordWebhookService } from './discord-webhook.service';
import { DiscordInteraction } from '../types/discord.types';

@ApiTags('Webhooks')
@ApiExcludeController()
@Controller('webhooks/discord')
export class DiscordInteractionsController {
  constructor(private readonly service: DiscordWebhookService) {}

  /**
   * Discord application Interactions endpoint. Per-credential URL so the
   * Ed25519 public key resolution is unambiguous. Discord requires the
   * endpoint to respond synchronously to validate the URL during setup.
   */
  @Public()
  @Post(':credentialId/interactions')
  @UseGuards(DiscordEd25519Guard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Discord interactions endpoint' })
  async receive(
    @Param('credentialId', new ParseUUIDPipe()) credentialId: string,
    @Body() interaction: DiscordInteraction,
    @Req() request: FastifyRequest & { rawBody?: Buffer },
  ): Promise<{ type: number; data?: unknown }> {
    const rawBody = request.rawBody ?? Buffer.from(JSON.stringify(interaction), 'utf8');
    return this.service.handleInteraction(
      credentialId,
      interaction,
      rawBody,
      request.headers as Record<string, string | string[] | undefined>,
    );
  }
}

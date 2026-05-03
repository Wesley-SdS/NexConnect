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
import { TelegramSecretTokenGuard } from './telegram-secret-token.guard';
import { TelegramWebhookService } from './telegram-webhook.service';
import { TelegramUpdate } from '../types/telegram.types';

@ApiTags('Webhooks')
@ApiExcludeController()
@Controller('webhooks/telegram')
export class TelegramWebhookController {
  constructor(private readonly service: TelegramWebhookService) {}

  /**
   * Telegram Bot API webhook endpoint, scoped per credential id so
   * multiple bots can coexist on the same NexConnect deployment.
   * Set the URL via Bot API setWebhook with a secret_token equal to
   * `ProviderCredential.webhookSecretToken`.
   */
  @Public()
  @Post(':credentialId')
  @UseGuards(TelegramSecretTokenGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Telegram Bot API webhook receiver' })
  async receive(
    @Param('credentialId', new ParseUUIDPipe()) credentialId: string,
    @Body() update: TelegramUpdate,
    @Req() request: FastifyRequest & { rawBody?: Buffer },
  ): Promise<{ ok: true; accepted: number }> {
    const rawBody = request.rawBody ?? Buffer.from(JSON.stringify(update), 'utf8');
    const result = await this.service.handleUpdate(
      credentialId,
      update,
      rawBody,
      request.headers as Record<string, string | string[] | undefined>,
    );
    return { ok: true, accepted: result.accepted };
  }
}

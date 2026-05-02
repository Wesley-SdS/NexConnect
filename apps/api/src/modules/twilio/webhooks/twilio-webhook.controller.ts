import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import {
  TwilioInboundMessageWebhook,
  TwilioMessageStatusWebhook,
  TwilioVoiceStatusWebhook,
} from '../types/twilio.types';
import { TwilioSignatureGuard } from './twilio-signature.guard';
import { TwilioWebhookService } from './twilio-webhook.service';

@ApiTags('Webhooks')
@ApiExcludeController()
@Controller('webhooks/twilio')
export class TwilioWebhookController {
  private readonly logger = new Logger(TwilioWebhookController.name);

  constructor(private readonly service: TwilioWebhookService) {}

  @Public()
  @Post('messages/inbound')
  @UseGuards(TwilioSignatureGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Twilio inbound SMS/WhatsApp receiver' })
  async inbound(
    @Body() body: TwilioInboundMessageWebhook,
    @Headers() headers: Record<string, string>,
  ): Promise<{ ok: true }> {
    await this.service.handleInboundMessage(body, headers);
    return { ok: true };
  }

  @Public()
  @Post('messages/status')
  @UseGuards(TwilioSignatureGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Twilio message status callback' })
  async status(
    @Body() body: TwilioMessageStatusWebhook,
    @Headers() headers: Record<string, string>,
  ): Promise<{ ok: true }> {
    await this.service.handleMessageStatus(body, headers);
    return { ok: true };
  }

  @Public()
  @Post('voice/status')
  @UseGuards(TwilioSignatureGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Twilio voice call status callback' })
  async voiceStatus(
    @Body() body: TwilioVoiceStatusWebhook,
    @Headers() headers: Record<string, string>,
  ): Promise<{ ok: true }> {
    await this.service.handleVoiceStatus(body, headers);
    return { ok: true };
  }
}

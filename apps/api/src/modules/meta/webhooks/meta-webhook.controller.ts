import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiExcludeController,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { Public } from '../../../common/decorators/public.decorator';
import { MetaSignatureGuard } from './meta-signature.guard';
import { MetaWebhookService } from './meta-webhook.service';
import { GraphWebhookPayload } from '../types/graph-api.types';

interface MetaVerifyQuery {
  'hub.mode'?: string;
  'hub.verify_token'?: string;
  'hub.challenge'?: string;
}

@ApiTags('Webhooks')
@ApiExcludeController()
@Controller('webhooks/meta')
export class MetaWebhookController {
  private readonly logger = new Logger(MetaWebhookController.name);

  constructor(private readonly service: MetaWebhookService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Meta webhook verification (GET)' })
  @ApiQuery({ name: 'hub.mode', required: true })
  @ApiQuery({ name: 'hub.verify_token', required: true })
  @ApiQuery({ name: 'hub.challenge', required: true })
  @ApiResponse({ status: 200, description: 'Returns hub.challenge verbatim' })
  @ApiResponse({ status: 403, description: 'Invalid verify token' })
  verify(@Query() query: MetaVerifyQuery): string {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;

    if (!expected) {
      this.logger.error('META_WEBHOOK_VERIFY_TOKEN is not configured');
      throw new UnauthorizedException('Webhook verification is not configured');
    }
    if (!mode || !token || !challenge) {
      throw new BadRequestException('Missing hub.mode, hub.verify_token, or hub.challenge');
    }
    if (mode !== 'subscribe') {
      throw new BadRequestException(`Unsupported hub.mode: ${mode}`);
    }
    if (token !== expected) {
      this.logger.warn('meta.webhook.verify.invalid-token');
      throw new UnauthorizedException('Invalid verify token');
    }
    this.logger.log('meta.webhook.verify.ok');
    return challenge;
  }

  @Public()
  @Post()
  @UseGuards(MetaSignatureGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Meta webhook event receiver (POST)' })
  @ApiResponse({ status: 200, description: 'Event accepted' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  async receive(
    @Body() body: GraphWebhookPayload,
    @Req() request: FastifyRequest & { rawBody?: Buffer },
  ): Promise<{ accepted: number }> {
    const rawBody = request.rawBody ?? Buffer.from(JSON.stringify(body), 'utf8');
    const headers = request.headers as Record<string, string | string[] | undefined>;

    try {
      const result = await this.service.handle(body, rawBody, headers);
      this.logger.log(
        { object: body.object, entries: body.entry?.length ?? 0, accepted: result.accepted },
        'meta.webhook.received',
      );
      return result;
    } catch (err) {
      this.logger.error(
        { err: (err as Error).message, stack: (err as Error).stack },
        'meta.webhook.processing-failed',
      );
      return { accepted: 0 };
    }
  }
}

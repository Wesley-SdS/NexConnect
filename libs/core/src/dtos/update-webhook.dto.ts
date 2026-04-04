import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWebhookDto {
  @ApiProperty({ description: 'Webhook display name', example: 'Order notifications', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ description: 'Webhook destination URL', example: 'https://api.example.com/webhook', required: false })
  @IsUrl()
  @IsOptional()
  url?: string;

  @ApiProperty({ description: 'Test URL for webhook dry-runs', example: 'https://api.example.com/webhook-test', required: false })
  @IsUrl()
  @IsOptional()
  testUrl?: string;

  @ApiProperty({ description: 'Whether the webhook is active', example: true, required: false })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiProperty({ description: 'Whether webhook runs in test mode', example: false, required: false })
  @IsBoolean()
  @IsOptional()
  testMode?: boolean;

  @ApiProperty({ description: 'List of events the webhook subscribes to', example: ['message.received', 'message.sent'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  events?: string[];

  @ApiProperty({ description: 'HMAC secret for webhook signature', example: 'whsec_abc123', required: false })
  @IsString()
  @IsOptional()
  secret?: string;

  @ApiProperty({ description: 'Custom headers sent with webhook requests', example: { 'X-Custom': 'value' }, required: false })
  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @ApiProperty({ description: 'Max retry attempts on delivery failure', example: 3, required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(10)
  retryMaxAttempts?: number;

  @ApiProperty({ description: 'Backoff base multiplier for retries', example: 2, required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(10)
  retryBackoffBase?: number;
}

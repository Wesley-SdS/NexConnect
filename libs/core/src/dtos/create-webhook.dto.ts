import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateWebhookDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsUrl()
  @IsNotEmpty()
  url: string;

  @IsUrl()
  @IsOptional()
  testUrl?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  testMode?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  events: string[];

  @IsString()
  @IsNotEmpty()
  secret: string;

  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(10)
  retryMaxAttempts?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(10)
  retryBackoffBase?: number;
}

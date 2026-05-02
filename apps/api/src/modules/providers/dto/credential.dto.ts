import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ProviderType } from '@nexconnect/core';

export class CreateCredentialDto {
  @ApiProperty({ enum: ProviderType })
  @IsEnum(ProviderType)
  provider!: ProviderType;

  @ApiProperty({ description: 'Human-readable label', example: 'WABA Production' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  displayName!: string;

  @ApiProperty({
    description: 'Plain-text credential payload. Shape depends on `provider`. See ProviderCredentialData.',
    type: Object,
  })
  @IsObject()
  credentials!: Record<string, unknown>;

  @ApiProperty({ required: false, description: 'Associate the credential with a specific instance' })
  @IsOptional()
  @IsUUID()
  instanceId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl({ require_tld: false })
  webhookCallbackUrl?: string;

  @ApiProperty({ required: false, type: String, example: '2027-01-01T00:00:00Z' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateCredentialDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  displayName?: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl({ require_tld: false })
  webhookCallbackUrl?: string;

  @ApiProperty({ required: false, enum: ['ACTIVE', 'REVOKED', 'EXPIRED', 'ERROR'] })
  @IsOptional()
  @IsEnum(['ACTIVE', 'REVOKED', 'EXPIRED', 'ERROR'])
  status?: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'ERROR';

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiProperty({ required: false, type: String })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class ListCredentialsQueryDto {
  @ApiProperty({ required: false, enum: ProviderType })
  @IsOptional()
  @IsEnum(ProviderType)
  provider?: ProviderType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  instanceId?: string;
}

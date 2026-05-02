import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MessageType } from '../enums';
import { ProviderType } from '../providers/provider-type.enum';

export class SendMessageDto {
  @ApiProperty({ description: 'Recipient phone number or JID', example: '5511999999999' })
  @IsString()
  @IsNotEmpty()
  to!: string;

  @ApiProperty({ description: 'Message type', enum: MessageType, example: MessageType.TEXT })
  @IsEnum(MessageType)
  type!: MessageType;

  @ApiProperty({ description: 'Message content payload', example: { text: 'Hello from NexConnect!' } })
  @IsObject()
  @IsNotEmpty()
  content!: Record<string, unknown>;

  @ApiProperty({ description: 'Schedule message for a future date (ISO 8601)', example: '2026-04-01T10:00:00Z', required: false })
  @IsDateString()
  @IsOptional()
  sendAt?: string;

  @ApiProperty({ description: 'ID of the message to quote/reply', example: 'msg_abc123', required: false })
  @IsString()
  @IsOptional()
  quotedId?: string;

  @ApiProperty({ description: 'Arbitrary metadata attached to the message', example: { orderId: '12345' }, required: false })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiProperty({
    description: 'Specific provider credential to use. When omitted, the instance default credential is used.',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  credentialId?: string;

  @ApiProperty({
    description: 'Explicit provider hint to disambiguate between multiple credentials on the same instance.',
    enum: ProviderType,
    required: false,
  })
  @IsEnum(ProviderType)
  @IsOptional()
  provider?: ProviderType;
}

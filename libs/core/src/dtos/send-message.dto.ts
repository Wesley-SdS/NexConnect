import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { MessageType } from '../enums';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  to: string;

  @IsEnum(MessageType)
  type: MessageType;

  @IsObject()
  @IsNotEmpty()
  content: Record<string, unknown>;

  @IsDateString()
  @IsOptional()
  sendAt?: string;

  @IsString()
  @IsOptional()
  quotedId?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ConnectionType } from '../enums';

export class CreateInstanceDto {
  @ApiProperty({ description: 'Instance display name', example: 'Support Line 1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Connection type for the WhatsApp instance', enum: ConnectionType, example: ConnectionType.QR_CODE })
  @IsEnum(ConnectionType)
  connectionType!: ConnectionType;

  @ApiProperty({ description: 'Optional instance settings', example: { autoReconnect: true }, required: false })
  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;
}

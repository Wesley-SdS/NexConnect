import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ConnectionType } from '../enums';

export class UpdateInstanceDto {
  @ApiProperty({ description: 'Instance display name', example: 'Support Line 1', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ description: 'Connection type for the WhatsApp instance', enum: ConnectionType, example: ConnectionType.QR_CODE, required: false })
  @IsEnum(ConnectionType)
  @IsOptional()
  connectionType?: ConnectionType;

  @ApiProperty({ description: 'Instance settings', example: { autoReconnect: true }, required: false })
  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;
}

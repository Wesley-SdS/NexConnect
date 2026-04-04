import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ConnectionType } from '../enums';

export class UpdateInstanceDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsEnum(ConnectionType)
  @IsOptional()
  connectionType?: ConnectionType;

  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;
}

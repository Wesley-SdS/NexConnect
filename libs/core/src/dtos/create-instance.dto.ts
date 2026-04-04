import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ConnectionType } from '../enums';

export class CreateInstanceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEnum(ConnectionType)
  connectionType: ConnectionType;

  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;
}

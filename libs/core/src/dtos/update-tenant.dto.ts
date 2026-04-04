import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TenantPlan } from '../enums';

export class UpdateTenantDto {
  @ApiProperty({ description: 'Tenant display name', example: 'Acme Corp', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ description: 'Subscription plan', enum: TenantPlan, example: TenantPlan.PRO, required: false })
  @IsEnum(TenantPlan)
  @IsOptional()
  plan?: TenantPlan;

  @ApiProperty({ description: 'Contact email for the tenant', example: 'admin@acme.com', required: false })
  @IsString()
  @IsOptional()
  email?: string;
}

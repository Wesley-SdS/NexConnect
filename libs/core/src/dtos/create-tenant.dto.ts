import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TenantPlan } from '../enums';

export class CreateTenantDto {
  @ApiProperty({ description: 'Tenant display name', example: 'Acme Corp' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Subscription plan', enum: TenantPlan, example: TenantPlan.STARTER })
  @IsEnum(TenantPlan)
  @IsNotEmpty()
  plan!: TenantPlan;

  @ApiProperty({ description: 'Contact email for the tenant', example: 'admin@acme.com', required: false })
  @IsString()
  @IsOptional()
  email?: string;
}

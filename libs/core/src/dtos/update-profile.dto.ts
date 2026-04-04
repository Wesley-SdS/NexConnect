import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({ description: 'Display name for the WhatsApp profile', example: 'My Business', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ description: 'Profile status text', example: 'Available for support', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  status?: string;

  @ApiProperty({ description: 'Profile picture URL', example: 'https://cdn.example.com/avatar.png', required: false })
  @IsString()
  @IsOptional()
  pictureUrl?: string;
}

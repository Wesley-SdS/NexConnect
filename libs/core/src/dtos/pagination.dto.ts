import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class PaginationDto {
  @ApiProperty({ description: 'Page number (1-based)', example: 1, required: false })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: 'Items per page (max 100)', example: 20, required: false })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({ description: 'Field to sort by', example: 'createdAt', required: false })
  @IsString()
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiProperty({ description: 'Sort order', enum: SortOrder, example: SortOrder.DESC, required: false })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.DESC;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ description: 'Array of results' })
  data: T[];

  @ApiProperty({
    description: 'Pagination metadata',
    example: { page: 1, limit: 20, total: 100, totalPages: 5, hasNext: true, hasPrevious: false },
  })
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };

  constructor(data: T[], total: number, page: number, limit: number) {
    const totalPages = Math.ceil(total / limit);

    this.data = data;
    this.meta = {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }
}

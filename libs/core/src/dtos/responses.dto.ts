import { ApiProperty } from '@nestjs/swagger';

export class ActionResponseDto {
  @ApiProperty({ description: 'Response message', example: 'Action completed successfully' })
  message!: string;
}

export class ActionWithIdResponseDto extends ActionResponseDto {
  @ApiProperty({ description: 'ID of the affected resource', example: '550e8400-e29b-41d4-a716-446655440000' })
  resourceId!: string;
}

export class PaginationMetaDto {
  @ApiProperty({ description: 'Current page number', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Total number of items', example: 100 })
  total!: number;

  @ApiProperty({ description: 'Total number of pages', example: 5 })
  totalPages!: number;

  @ApiProperty({ description: 'Whether there is a next page', example: true })
  hasNext!: boolean;

  @ApiProperty({ description: 'Whether there is a previous page', example: false })
  hasPrevious!: boolean;
}

export class ApiErrorResponseDto {
  @ApiProperty({ description: 'HTTP status code', example: 400 })
  statusCode!: number;

  @ApiProperty({ description: 'Error type', example: 'Bad Request' })
  error!: string;

  @ApiProperty({ description: 'Error message', example: 'Validation failed' })
  message!: string;

  @ApiProperty({ description: 'Timestamp of the error', example: '2026-04-04T12:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ description: 'Request path', example: '/api/v1/instances' })
  path!: string;

  @ApiProperty({ description: 'Unique request identifier', example: 'req-550e8400-e29b-41d4-a716-446655440000' })
  requestId!: string;
}

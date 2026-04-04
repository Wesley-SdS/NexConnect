import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiBody, ApiProperty } from '@nestjs/swagger';
import { VerificationService, type VerificationResult } from './verification.service';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';

class VerifyBatchDto {
  @ApiProperty({ description: 'List of phone numbers to verify', example: ['5511999999999', '5511888888888'] })
  phones!: string[];
}

@ApiTags('Verification')
@ApiBearerAuth()
@Controller('instances/:instanceId/recipients')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get(':number')
  @RequiredScopes('read')
  @ApiOperation({ summary: 'Verify single number', description: 'Checks whether a phone number has an active WhatsApp account' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiParam({ name: 'number', description: 'Phone number to verify', example: '5511999999999' })
  @ApiResponse({ status: 200, description: 'Verification result returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  verifySingle(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('number') number: string,
  ): Promise<VerificationResult> {
    return this.verificationService.verifySingle(
      tenant.id,
      instanceId,
      number,
    );
  }

  @Post('batch')
  @RequiredScopes('read')
  @ApiOperation({ summary: 'Verify batch of numbers', description: 'Checks multiple phone numbers for WhatsApp accounts in a single request' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiBody({ type: VerifyBatchDto })
  @ApiResponse({ status: 200, description: 'Batch verification results returned' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 422, description: 'Too many numbers in batch' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  verifyBatch(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body() dto: VerifyBatchDto,
  ): Promise<VerificationResult[]> {
    return this.verificationService.verifyBatch(
      tenant.id,
      instanceId,
      dto.phones,
    );
  }
}

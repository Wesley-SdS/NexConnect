import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiBody, ApiProperty } from '@nestjs/swagger';
import { BlacklistService } from './blacklist.service';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';

class AddToBlacklistDto {
  @ApiProperty({ description: 'Phone number to block', example: '5511999999999' })
  phone!: string;

  @ApiProperty({ description: 'Reason for blocking', example: 'Spam behavior' })
  reason!: string;
}

class AddToWhitelistDto {
  @ApiProperty({ description: 'Phone number to whitelist', example: '5511999999999' })
  phone!: string;
}

@ApiTags('Blacklist & Whitelist')
@ApiBearerAuth()
@Controller('instances/:instanceId')
export class BlacklistController {
  constructor(private readonly blacklistService: BlacklistService) {}

  // ─── Blacklist ────────────────────────────────────────

  @Get('blacklist')
  @RequiredScopes('read')
  @ApiOperation({ summary: 'Get blacklist', description: 'Returns all blocked phone numbers for the instance' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiResponse({ status: 200, description: 'Blacklist retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  getBlacklist(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
  ) {
    return this.blacklistService.getBlacklist(tenant.id, instanceId);
  }

  @Post('blacklist')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Add to blacklist', description: 'Blocks a phone number from interacting with the instance' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiBody({ type: AddToBlacklistDto })
  @ApiResponse({ status: 201, description: 'Phone added to blacklist' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 409, description: 'Phone already blacklisted' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  addToBlacklist(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body() dto: AddToBlacklistDto,
  ) {
    return this.blacklistService.addToBlacklist(tenant.id, instanceId, dto);
  }

  @Delete('blacklist/:phone')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Remove from blacklist', description: 'Unblocks a phone number' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiParam({ name: 'phone', description: 'Phone number to unblock' })
  @ApiResponse({ status: 200, description: 'Phone removed from blacklist' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Phone not found in blacklist' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  removeFromBlacklist(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('phone') phone: string,
  ) {
    return this.blacklistService.removeFromBlacklist(
      tenant.id,
      instanceId,
      phone,
    );
  }

  // ─── Whitelist ────────────────────────────────────────

  @Get('whitelist')
  @RequiredScopes('read')
  @ApiOperation({ summary: 'Get whitelist', description: 'Returns all whitelisted phone numbers for the instance' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiResponse({ status: 200, description: 'Whitelist retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  getWhitelist(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
  ) {
    return this.blacklistService.getWhitelist(tenant.id, instanceId);
  }

  @Post('whitelist')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Add to whitelist', description: 'Adds a phone number to the instance whitelist' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiBody({ type: AddToWhitelistDto })
  @ApiResponse({ status: 201, description: 'Phone added to whitelist' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 409, description: 'Phone already whitelisted' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  addToWhitelist(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body() dto: AddToWhitelistDto,
  ) {
    return this.blacklistService.addToWhitelist(tenant.id, instanceId, dto);
  }

  @Delete('whitelist/:phone')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Remove from whitelist', description: 'Removes a phone number from the whitelist' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiParam({ name: 'phone', description: 'Phone number to remove' })
  @ApiResponse({ status: 200, description: 'Phone removed from whitelist' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Phone not found in whitelist' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  removeFromWhitelist(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('phone') phone: string,
  ) {
    return this.blacklistService.removeFromWhitelist(
      tenant.id,
      instanceId,
      phone,
    );
  }
}

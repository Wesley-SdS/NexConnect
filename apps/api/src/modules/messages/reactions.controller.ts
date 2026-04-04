import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiBody, ApiProperty } from '@nestjs/swagger';
import { ReactionsService } from './reactions.service';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';

class AddReactionDto {
  @ApiProperty({ description: 'Emoji to react with', example: '👍' })
  emoji!: string;
}

@ApiTags('Reactions')
@ApiBearerAuth()
@Controller('instances/:instanceId/messages/:msgId/reactions')
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Post()
  @RequiredScopes('send')
  @ApiOperation({ summary: 'Add reaction', description: 'Adds an emoji reaction to a specific message' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiParam({ name: 'msgId', description: 'Message ID to react to' })
  @ApiBody({ type: AddReactionDto })
  @ApiResponse({ status: 201, description: 'Reaction added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid emoji' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Message or instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  addReaction(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('msgId') msgId: string,
    @Body() dto: AddReactionDto,
  ) {
    return this.reactionsService.addReaction(
      tenant.id,
      instanceId,
      msgId,
      dto,
    );
  }

  @Delete()
  @RequiredScopes('send')
  @ApiOperation({ summary: 'Remove reaction', description: 'Removes the current reaction from a message' })
  @ApiParam({ name: 'instanceId', description: 'Instance UUID' })
  @ApiParam({ name: 'msgId', description: 'Message ID to remove reaction from' })
  @ApiResponse({ status: 200, description: 'Reaction removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Message or instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  removeReaction(
    @CurrentTenant() tenant: { id: string },
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('msgId') msgId: string,
  ) {
    return this.reactionsService.removeReaction(
      tenant.id,
      instanceId,
      msgId,
    );
  }
}

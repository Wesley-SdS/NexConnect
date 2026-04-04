import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiBody, ApiProperty } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { InstancesService } from './instances.service';

class PostTextStoryDto {
  @ApiProperty({ description: 'Story text content', example: 'Check out our new product!' })
  text!: string;

  @ApiProperty({ description: 'Background color hex code', example: '#FF5733', required: false })
  backgroundColor?: string;

  @ApiProperty({ description: 'Font index (0-5)', example: 1, required: false })
  font?: number;
}

class PostMediaStoryDto {
  @ApiProperty({ description: 'Public URL of the media file', example: 'https://cdn.example.com/story.jpg' })
  mediaUrl!: string;

  @ApiProperty({ description: 'Media type', enum: ['image', 'video'], example: 'image' })
  mediaType!: 'image' | 'video';

  @ApiProperty({ description: 'Optional caption for the media', example: 'Our latest collection', required: false })
  caption?: string;
}

@ApiTags('Stories')
@ApiBearerAuth()
@Controller('instances/:id/stories')
export class StoriesController {
  constructor(
    private readonly instancesService: InstancesService,
    @InjectQueue('instance-lifecycle')
    private readonly lifecycleQueue: Queue,
  ) {}

  @Get()
  @RequiredScopes('read')
  @ApiOperation({ summary: 'Get stories', description: 'Fetches all visible WhatsApp stories/status updates for the instance' })
  @ApiParam({ name: 'id', description: 'Instance UUID' })
  @ApiResponse({ status: 200, description: 'Stories fetch dispatched' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async getStories(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.instancesService.findOne(tenant.id, id);

    await this.lifecycleQueue.add('get-stories', {
      instanceId: id,
      tenantId: tenant.id,
    });

    return { message: 'Stories fetch dispatched' };
  }

  @Post('text')
  @RequiredScopes('send')
  @ApiOperation({ summary: 'Post text story', description: 'Posts a text-based WhatsApp status/story' })
  @ApiParam({ name: 'id', description: 'Instance UUID' })
  @ApiBody({ type: PostTextStoryDto })
  @ApiResponse({ status: 201, description: 'Text story post dispatched' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async postTextStory(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PostTextStoryDto,
  ) {
    await this.instancesService.findOne(tenant.id, id);

    await this.lifecycleQueue.add('post-text-story', {
      instanceId: id,
      tenantId: tenant.id,
      ...dto,
    });

    return { message: 'Text story post dispatched' };
  }

  @Post('media')
  @RequiredScopes('send')
  @ApiOperation({ summary: 'Post media story', description: 'Posts an image or video WhatsApp status/story' })
  @ApiParam({ name: 'id', description: 'Instance UUID' })
  @ApiBody({ type: PostMediaStoryDto })
  @ApiResponse({ status: 201, description: 'Media story post dispatched' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async postMediaStory(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PostMediaStoryDto,
  ) {
    await this.instancesService.findOne(tenant.id, id);

    await this.lifecycleQueue.add('post-media-story', {
      instanceId: id,
      tenantId: tenant.id,
      ...dto,
    });

    return { message: 'Media story post dispatched' };
  }

  @Delete(':storyId')
  @RequiredScopes('admin')
  @ApiOperation({ summary: 'Delete story', description: 'Removes a previously posted story/status update' })
  @ApiParam({ name: 'id', description: 'Instance UUID' })
  @ApiParam({ name: 'storyId', description: 'Story identifier' })
  @ApiResponse({ status: 200, description: 'Story deletion dispatched' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid API key' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient scopes' })
  @ApiResponse({ status: 404, description: 'Instance or story not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async deleteStory(
    @CurrentTenant() tenant: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('storyId') storyId: string,
  ) {
    await this.instancesService.findOne(tenant.id, id);

    await this.lifecycleQueue.add('delete-story', {
      instanceId: id,
      tenantId: tenant.id,
      storyId,
    });

    return { message: 'Story deletion dispatched' };
  }
}

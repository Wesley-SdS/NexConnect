import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RequiredScopes } from '../../common/decorators/api-key-scopes.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { InstancesService } from './instances.service';

class PostTextStoryDto {
  text!: string;
  backgroundColor?: string;
  font?: number;
}

class PostMediaStoryDto {
  mediaUrl!: string;
  mediaType!: 'image' | 'video';
  caption?: string;
}

@Controller('instances/:id/stories')
export class StoriesController {
  constructor(
    private readonly instancesService: InstancesService,
    @InjectQueue('instance-lifecycle')
    private readonly lifecycleQueue: Queue,
  ) {}

  @Get()
  @RequiredScopes('read')
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

import { Module } from '@nestjs/common';
import { MediaUploadService } from './media-upload.service';
import { MediaDownloadService } from './media-download.service';

@Module({
  providers: [MediaUploadService, MediaDownloadService],
  exports: [MediaUploadService, MediaDownloadService],
})
export class MediaModule {}

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MessagePipelineService } from './message-pipeline.service';
import { MessageDeduplicationStage } from './stages/deduplication.stage';
import { MessageClassificationStage } from './stages/classification.stage';
import { MessageBufferStage } from './stages/buffer.stage';
import { MediaProcessingStage } from './stages/media-processing.stage';
import { MessageEnrichmentStage } from './stages/enrichment.stage';
import { PresenceUpdateStage } from './stages/presence.stage';
import { WebhookForwardStage } from './stages/forward.stage';
import { SpeechToTextService } from '../services/speech-to-text.service';
import { WorkerMediaUploadService } from '../services/media-upload.service';
import { MediaCompressionService } from '../services/media-compression.service';
import { VideoThumbnailService } from '../services/video-thumbnail.service';
import { MediaConversionService } from '../services/media-conversion.service';
import { WhisperSttProvider } from '../services/stt-providers/whisper.provider';
import { AssemblyAiSttProvider } from '../services/stt-providers/assemblyai.provider';
import { AzureSpeechProvider } from '../services/stt-providers/azure-speech.provider';
import { ConnectionModule } from '../connection/connection.module';

@Module({
  imports: [
    ConnectionModule,
    BullModule.registerQueue({ name: 'webhook-delivery' }),
  ],
  providers: [
    MessagePipelineService,
    MessageDeduplicationStage,
    MessageClassificationStage,
    MessageBufferStage,
    MediaProcessingStage,
    MessageEnrichmentStage,
    PresenceUpdateStage,
    WebhookForwardStage,
    SpeechToTextService,
    WorkerMediaUploadService,
    MediaCompressionService,
    VideoThumbnailService,
    MediaConversionService,
    WhisperSttProvider,
    AssemblyAiSttProvider,
    AzureSpeechProvider,
  ],
  exports: [MessagePipelineService],
})
export class PipelineModule {}

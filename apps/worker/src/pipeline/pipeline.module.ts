import { Module } from '@nestjs/common';
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
import { WhisperSttProvider } from '../services/stt-providers/whisper.provider';
import { AssemblyAiSttProvider } from '../services/stt-providers/assemblyai.provider';
import { AzureSpeechProvider } from '../services/stt-providers/azure-speech.provider';

@Module({
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
    WhisperSttProvider,
    AssemblyAiSttProvider,
    AzureSpeechProvider,
  ],
  exports: [MessagePipelineService],
})
export class PipelineModule {}

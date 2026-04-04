import { Injectable, Logger } from '@nestjs/common';
import { IPipelineStage, MessageContext } from '@nexconnect/core';
import { MessageDeduplicationStage } from './stages/deduplication.stage';
import { MessageClassificationStage } from './stages/classification.stage';
import { MessageBufferStage } from './stages/buffer.stage';
import { MediaProcessingStage } from './stages/media-processing.stage';
import { MessageEnrichmentStage } from './stages/enrichment.stage';
import { PresenceUpdateStage } from './stages/presence.stage';
import { WebhookForwardStage } from './stages/forward.stage';

@Injectable()
export class MessagePipelineService {
  private readonly logger = new Logger(MessagePipelineService.name);
  private readonly stages: IPipelineStage[];

  constructor(
    deduplication: MessageDeduplicationStage,
    classification: MessageClassificationStage,
    buffer: MessageBufferStage,
    mediaProcessing: MediaProcessingStage,
    enrichment: MessageEnrichmentStage,
    presence: PresenceUpdateStage,
    forward: WebhookForwardStage,
  ) {
    this.stages = [
      deduplication,
      classification,
      buffer,
      mediaProcessing,
      enrichment,
      presence,
      forward,
    ];
  }

  async process(context: MessageContext): Promise<MessageContext | null> {
    const pipelineStart = Date.now();

    this.logger.log('Pipeline started', {
      messageId: context.id,
      instanceId: context.instanceId,
      stageCount: this.stages.length,
    });

    let currentContext: MessageContext | null = context;

    for (const stage of this.stages) {
      const stageName = stage.constructor.name;
      const stageStart = Date.now();

      try {
        currentContext = await stage.execute(currentContext);

        const stageDuration = Date.now() - stageStart;
        this.logger.debug('Stage completed', {
          stage: stageName,
          messageId: context.id,
          durationMs: stageDuration,
        });

        if (currentContext === null) {
          this.logger.log('Pipeline halted by stage', {
            stage: stageName,
            messageId: context.id,
            totalDurationMs: Date.now() - pipelineStart,
          });
          return null;
        }
      } catch (error) {
        const stageDuration = Date.now() - stageStart;
        this.logger.error('Stage failed', {
          stage: stageName,
          messageId: context.id,
          durationMs: stageDuration,
          error: (error as Error).message,
          stack: (error as Error).stack,
        });
        throw error;
      }
    }

    const totalDuration = Date.now() - pipelineStart;
    this.logger.log('Pipeline completed', {
      messageId: context.id,
      instanceId: context.instanceId,
      totalDurationMs: totalDuration,
    });

    return currentContext;
  }
}

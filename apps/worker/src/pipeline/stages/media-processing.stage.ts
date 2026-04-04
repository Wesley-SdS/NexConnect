import { Injectable, Logger } from '@nestjs/common';
import { IPipelineStage, MessageContext, MessageType } from '@nexconnect/core';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { WorkerMediaUploadService } from '../../services/media-upload.service';
import { SpeechToTextService } from '../../services/speech-to-text.service';

const MEDIA_TYPES = new Set<MessageType>([
  MessageType.IMAGE,
  MessageType.VIDEO,
  MessageType.AUDIO,
  MessageType.DOCUMENT,
  MessageType.STICKER,
]);

@Injectable()
export class MediaProcessingStage implements IPipelineStage {
  private readonly logger = new Logger(MediaProcessingStage.name);

  constructor(
    private readonly mediaUpload: WorkerMediaUploadService,
    private readonly speechToText: SpeechToTextService,
  ) {}

  async execute(context: MessageContext): Promise<MessageContext | null> {
    if (!context.messageType || !MEDIA_TYPES.has(context.messageType)) {
      return context;
    }

    this.logger.debug('Processing media message', {
      messageId: context.id,
      messageType: context.messageType,
    });

    const mediaBuffer = await this.downloadMedia(context);
    if (!mediaBuffer) {
      this.logger.warn('Failed to download media', {
        messageId: context.id,
      });
      return context;
    }

    const mimetype = this.extractMimetype(context);
    const mediaUrl = await this.mediaUpload.upload(
      mediaBuffer,
      context.instanceId,
      context.id,
      mimetype,
    );

    let transcription: string | undefined;

    if (context.messageType === MessageType.AUDIO) {
      try {
        const language =
          process.env.DEFAULT_STT_LANGUAGE ?? 'pt';
        const provider =
          process.env.STT_PROVIDER ?? 'whisper';
        transcription = await this.speechToText.transcribe(
          mediaBuffer,
          language,
          provider,
        );
      } catch (error) {
        this.logger.error('Speech-to-text failed', {
          messageId: context.id,
          error: (error as Error).message,
        });
      }
    }

    this.logger.debug('Media processed', {
      messageId: context.id,
      mediaUrl,
      hasTranscription: !!transcription,
    });

    return {
      ...context,
      mediaUrl,
      transcription,
    };
  }

  private async downloadMedia(
    context: MessageContext,
  ): Promise<Buffer | null> {
    try {
      const buffer = await downloadMediaMessage(
        context.rawMessage as any,
        'buffer',
        {},
      );
      return buffer as Buffer;
    } catch (error) {
      this.logger.error('Media download error', {
        messageId: context.id,
        error: (error as Error).message,
      });
      return null;
    }
  }

  private extractMimetype(context: MessageContext): string {
    const message = context.rawMessage.message;
    if (!message) {
      return 'application/octet-stream';
    }

    const mediaMessage =
      (message as any).imageMessage ??
      (message as any).videoMessage ??
      (message as any).audioMessage ??
      (message as any).documentMessage ??
      (message as any).stickerMessage;

    return mediaMessage?.mimetype ?? 'application/octet-stream';
  }
}

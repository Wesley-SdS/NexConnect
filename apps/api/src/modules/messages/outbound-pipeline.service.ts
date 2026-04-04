import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@nexconnect/database';
import {
  IOutboundPipelineStage,
  OutboundMessage,
  ValidationStage,
  PhoneVerificationStage,
  AntiSpamStage,
  MediaPreparationStage,
} from './stages';

@Injectable()
export class OutboundPipelineService {
  private readonly logger = new Logger(OutboundPipelineService.name);
  private readonly stages: IOutboundPipelineStage[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly validationStage: ValidationStage,
    private readonly phoneVerificationStage: PhoneVerificationStage,
    private readonly antiSpamStage: AntiSpamStage,
    private readonly mediaPreparationStage: MediaPreparationStage,
  ) {
    this.stages = [
      this.validationStage,
      this.phoneVerificationStage,
      this.antiSpamStage,
      this.mediaPreparationStage,
    ];
  }

  async process(message: OutboundMessage): Promise<void> {
    try {
      await this.updateStatus(message.messageId, 'PROCESSING');

      for (const stage of this.stages) {
        await stage.execute(message);
      }

      await this.updateStatus(message.messageId, 'SENT');
    } catch (error) {
      this.logger.error(
        { messageId: message.messageId, err: error },
        'Pipeline failed',
      );
      await this.updateStatus(message.messageId, 'FAILED');
      throw error;
    }
  }

  private async updateStatus(
    messageId: string,
    status: 'PENDING' | 'PROCESSING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED',
  ): Promise<void> {
    await this.prisma.message.update({
      where: { id: messageId },
      data: { status },
    });
  }
}

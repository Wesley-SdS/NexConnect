import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@nexconnect/database';
import { CONSTANTS } from '@nexconnect/shared';

interface InstanceSettings {
  rejectCalls?: boolean;
  readReceipts?: boolean;
  typingIndicator?: boolean;
  messageRetryLimit?: number;
  webhookTimeout?: number;
  mediaAutoDownload?: boolean;
  groupsIgnore?: boolean;
}

@Injectable()
export class InstanceSettingsService {
  private readonly logger = new Logger(InstanceSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(instanceId: string): Promise<InstanceSettings> {
    const instance = await this.prisma.instance.findUnique({
      where: { id: instanceId },
      select: { settings: true },
    });

    return (instance?.settings as InstanceSettings) ?? {};
  }

  async updateSettings(
    instanceId: string,
    settings: Partial<InstanceSettings>,
  ): Promise<InstanceSettings> {
    this.validateSettings(settings);

    const current = await this.getSettings(instanceId);
    const merged = { ...current, ...settings };

    await this.prisma.instance.update({
      where: { id: instanceId },
      data: { settings: merged },
    });

    this.logger.log({ instanceId, updatedKeys: Object.keys(settings) }, 'Settings updated');

    return merged;
  }

  private validateSettings(settings: Partial<InstanceSettings>): void {
    if (
      settings.messageRetryLimit !== undefined &&
      (settings.messageRetryLimit < 0 || settings.messageRetryLimit > 10)
    ) {
      throw new BadRequestException('messageRetryLimit must be between 0 and 10');
    }

    if (
      settings.webhookTimeout !== undefined &&
      (settings.webhookTimeout < 1000 || settings.webhookTimeout > 30000)
    ) {
      throw new BadRequestException('webhookTimeout must be between 1000ms and 30000ms');
    }
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ProviderType,
  ProviderValidationError,
  TemplateOutboundMessage,
} from '@nexconnect/core';
import { PrismaService } from '@nexconnect/database';

interface TemplateComponentSpec {
  type: string;
  format?: string;
  text?: string;
  buttons?: unknown[];
}

/**
 * Validates a TemplateOutboundMessage against the components stored
 * locally for that provider's credential. Catches missing parameters
 * before the request hits Meta/Twilio (which would return a generic
 * 400 with little detail).
 */
@Injectable()
export class TemplateBindingValidator {
  constructor(private readonly prisma: PrismaService) {}

  async validate(
    tenantId: string,
    credentialId: string,
    message: TemplateOutboundMessage,
  ): Promise<void> {
    if (!message.template) {
      throw new ProviderValidationError(
        ProviderType.META_WHATSAPP_CLOUD,
        'TemplateOutboundMessage.template is required',
      );
    }

    // Twilio uses contentSid for templates; Meta uses name. Twilio side
    // is opaque and validated by Twilio itself, so skip local lookup.
    if (message.template.contentSid && !message.template.name) {
      return;
    }

    const template = await this.prisma.messageTemplate.findFirst({
      where: {
        tenantId,
        credentialId,
        name: message.template.name,
        language: message.template.language,
      },
    });

    if (!template) {
      throw new NotFoundException(
        `Template "${message.template.name}" (${message.template.language}) not found locally. Run POST /v1/providers/templates/sync first.`,
      );
    }

    if (template.status !== 'APPROVED') {
      throw new ProviderValidationError(
        ProviderType.META_WHATSAPP_CLOUD,
        `Template "${message.template.name}" is not APPROVED (current=${template.status}).`,
      );
    }

    const components = (template.components as TemplateComponentSpec[] | null) ?? [];
    const required = this.countRequiredVariables(components);
    const provided = (message.template.components ?? []).reduce(
      (acc, c) => acc + (c.parameters?.length ?? 0),
      0,
    );

    if (required > 0 && provided < required) {
      throw new ProviderValidationError(
        ProviderType.META_WHATSAPP_CLOUD,
        `Template "${message.template.name}" expects ${required} parameter(s) but ${provided} were supplied.`,
      );
    }
  }

  private countRequiredVariables(components: TemplateComponentSpec[]): number {
    let total = 0;
    for (const c of components) {
      if (typeof c.text === 'string') {
        const matches = c.text.match(/\{\{\d+\}\}/g);
        if (matches) total += matches.length;
      }
    }
    return total;
  }
}

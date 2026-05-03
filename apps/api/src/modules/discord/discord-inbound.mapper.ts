import { Injectable } from '@nestjs/common';
import {
  InboundMessage,
  InboundStatusKind,
  InboundStatusUpdate,
  MessageType,
  ProviderType,
} from '@nexconnect/core';
import {
  DiscordInteraction,
  DiscordMessage,
  InteractionType,
} from './types/discord.types';

@Injectable()
export class DiscordInboundMapper {
  fromInteraction(interaction: DiscordInteraction): InboundMessage | null {
    if (interaction.type === InteractionType.PING) {
      // Ping is handled by the controller before reaching the mapper.
      return null;
    }

    const sender = interaction.member?.user ?? interaction.user;
    if (!sender) return null;

    const type = this.classifyInteraction(interaction);

    return {
      provider: ProviderType.DISCORD,
      providerMessageId: interaction.id,
      fromAddress: sender.id,
      toAddress: interaction.channel_id ?? interaction.guild_id ?? '',
      contact: {
        profileName: sender.global_name ?? sender.username,
        messengerId: sender.id,
      },
      timestamp: new Date(),
      type,
      replyTo: interaction.message?.id,
      interactive: this.extractInteractive(interaction),
      text: interaction.data?.name,
      metadata: {
        interactionId: interaction.id,
        interactionToken: interaction.token,
        interactionType: interaction.type,
        applicationId: interaction.application_id,
        guildId: interaction.guild_id,
        channelId: interaction.channel_id,
        locale: interaction.locale,
        commandOptions: interaction.data?.options,
      },
    };
  }

  fromMessage(message: DiscordMessage): InboundMessage {
    return {
      provider: ProviderType.DISCORD,
      providerMessageId: message.id,
      fromAddress: message.author.id,
      toAddress: message.channel_id,
      contact: {
        profileName: message.author.global_name ?? message.author.username,
        messengerId: message.author.id,
      },
      timestamp: new Date(message.timestamp),
      type: this.classifyMessage(message),
      text: message.content,
      replyTo: message.referenced_message?.id ?? message.message_reference?.message_id,
      media: message.attachments.length > 0
        ? {
            url: message.attachments[0].url,
            mimeType: message.attachments[0].content_type ?? 'application/octet-stream',
            filename: message.attachments[0].filename,
            sizeBytes: message.attachments[0].size,
          }
        : undefined,
      metadata: {
        guildId: message.guild_id,
        channelId: message.channel_id,
        edited: Boolean(message.edited_timestamp),
        attachmentsCount: message.attachments.length,
      },
    };
  }

  private classifyInteraction(interaction: DiscordInteraction): MessageType {
    switch (interaction.type) {
      case InteractionType.APPLICATION_COMMAND:
        return MessageType.SLASH_COMMAND;
      case InteractionType.MESSAGE_COMPONENT:
        // 2 = button, 3 = string select, 5..8 = other selects
        if (interaction.data?.component_type === 2) return MessageType.BUTTON_REPLY;
        if (interaction.data?.component_type === 3) return MessageType.LIST_REPLY;
        return MessageType.BUTTON_REPLY;
      case InteractionType.MODAL_SUBMIT:
        return MessageType.TEXT;
      default:
        return MessageType.UNKNOWN;
    }
  }

  private extractInteractive(interaction: DiscordInteraction): InboundMessage['interactive'] {
    const data = interaction.data;
    if (!data) return undefined;

    if (interaction.type === InteractionType.MESSAGE_COMPONENT && data.custom_id) {
      if (data.component_type === 3 && data.values?.length) {
        return { kind: 'list_reply', id: data.values[0], title: data.values[0] };
      }
      return { kind: 'button_reply', id: data.custom_id, title: data.custom_id };
    }
    if (interaction.type === InteractionType.APPLICATION_COMMAND && data.name) {
      return { kind: 'button_reply', id: data.name, title: data.name };
    }
    return undefined;
  }

  private classifyMessage(message: DiscordMessage): MessageType {
    if (message.attachments.length > 0) {
      const att = message.attachments[0];
      if (att.content_type?.startsWith('image/')) return MessageType.IMAGE;
      if (att.content_type?.startsWith('video/')) return MessageType.VIDEO;
      if (att.content_type?.startsWith('audio/')) return MessageType.AUDIO;
      return MessageType.DOCUMENT;
    }
    return MessageType.TEXT;
  }
}

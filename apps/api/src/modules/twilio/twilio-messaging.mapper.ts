import { Injectable } from '@nestjs/common';
import {
  MessageType,
  OutboundMessage,
  ProviderType,
  ProviderUnsupportedOperationError,
  ProviderValidationError,
} from '@nexconnect/core';
import { PhoneUtil } from '@nexconnect/shared';
import { MessageListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/message';

export interface TwilioMapperInput {
  message: OutboundMessage;
  channel: 'sms' | 'whatsapp' | 'rcs';
  from?: string;
  messagingServiceSid?: string;
  statusCallback?: string;
  providerType: ProviderType;
}

@Injectable()
export class TwilioMessagingMapper {
  toCreateMessageOptions(input: TwilioMapperInput): MessageListInstanceCreateOptions {
    const to = this.formatAddress(input.message.to, input.channel, input.providerType);
    const base: MessageListInstanceCreateOptions = { to };

    if (input.from) base.from = this.formatAddress(input.from, input.channel, input.providerType);
    if (input.messagingServiceSid) base.messagingServiceSid = input.messagingServiceSid;
    if (!base.from && !base.messagingServiceSid) {
      throw new ProviderValidationError(
        input.providerType,
        'Either `from` or `messagingServiceSid` must be supplied',
      );
    }
    if (input.statusCallback) base.statusCallback = input.statusCallback;

    switch (input.message.type) {
      case MessageType.TEXT:
        base.body = input.message.text;
        break;
      case MessageType.IMAGE:
      case MessageType.VIDEO:
      case MessageType.AUDIO:
      case MessageType.DOCUMENT:
      case MessageType.STICKER:
        if (!input.message.media?.url) {
          throw new ProviderValidationError(input.providerType, 'Media URL is required');
        }
        base.mediaUrl = [input.message.media.url];
        if (input.message.media.caption) base.body = input.message.media.caption;
        break;
      case MessageType.LOCATION:
        base.body = this.formatLocation(input.message.location);
        break;
      default:
        throw new ProviderUnsupportedOperationError(
          input.providerType,
          `send:${input.message.type}`,
        );
    }

    if (input.message.idempotencyKey) {
      base.provideFeedback = false;
    }

    return base;
  }

  private formatLocation(loc: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  }): string {
    const label = loc.name ?? loc.address ?? `${loc.latitude},${loc.longitude}`;
    return `📍 ${label}\nhttps://maps.google.com/?q=${loc.latitude},${loc.longitude}`;
  }

  private formatAddress(
    address: string,
    channel: 'sms' | 'whatsapp' | 'rcs',
    providerType: ProviderType,
  ): string {
    if (channel === 'whatsapp') {
      if (address.startsWith('whatsapp:')) return address;
      const normalized = PhoneUtil.normalize(address);
      if (!normalized) {
        throw new ProviderValidationError(providerType, `Invalid phone number: ${address}`);
      }
      return `whatsapp:+${normalized}`;
    }
    if (channel === 'rcs') {
      if (address.startsWith('rcs:')) return address;
      const normalized = PhoneUtil.normalize(address);
      if (!normalized) {
        throw new ProviderValidationError(providerType, `Invalid phone number: ${address}`);
      }
      return `rcs:+${normalized}`;
    }
    if (address.startsWith('+')) return address;
    const normalized = PhoneUtil.normalize(address);
    if (!normalized) {
      throw new ProviderValidationError(providerType, `Invalid phone number: ${address}`);
    }
    return `+${normalized}`;
  }
}

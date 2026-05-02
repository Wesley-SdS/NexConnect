import { Injectable } from '@nestjs/common';
import {
  InboundMessage,
  InboundStatusKind,
  InboundStatusUpdate,
  MessageType,
  ProviderType,
} from '@nexconnect/core';
import {
  TwilioInboundMessageWebhook,
  TwilioMessageStatus,
  TwilioMessageStatusWebhook,
} from '../types/twilio.types';

@Injectable()
export class TwilioInboundMapper {
  mapInboundMessage(body: TwilioInboundMessageWebhook, provider: ProviderType): InboundMessage {
    const numMedia = Number(body.NumMedia ?? '0');
    const firstMediaUrl = body.MediaUrl0 as string | undefined;
    const firstMediaType = body.MediaContentType0 as string | undefined;

    const type = this.mapType(firstMediaType, body.Body);

    const inbound: InboundMessage = {
      provider,
      providerMessageId: body.MessageSid,
      fromAddress: this.stripChannelPrefix(body.From),
      toAddress: this.stripChannelPrefix(body.To),
      contact: {
        profileName: body.ProfileName,
        waId: body.WaId,
        phone: this.stripChannelPrefix(body.From),
      },
      timestamp: new Date(),
      type,
      text: body.Body,
      replyTo: body.OriginalRepliedMessageSid,
      metadata: {
        numMedia,
        fromCountry: body.FromCountry,
        fromState: body.FromState,
        fromCity: body.FromCity,
      },
    };

    if (numMedia > 0 && firstMediaUrl) {
      inbound.media = {
        url: firstMediaUrl,
        mimeType: firstMediaType ?? 'application/octet-stream',
      };
    }

    if (body.ButtonText || body.ButtonPayload) {
      inbound.interactive = {
        kind: 'button_reply',
        id: body.ButtonPayload ?? body.ButtonText ?? '',
        title: body.ButtonText ?? '',
      };
    }

    return inbound;
  }

  mapStatusUpdate(
    body: TwilioMessageStatusWebhook,
    provider: ProviderType,
  ): InboundStatusUpdate | null {
    const kind = this.mapStatus(body.MessageStatus as TwilioMessageStatus);
    if (!kind) return null;
    return {
      provider,
      providerMessageId: body.MessageSid,
      recipientId: this.stripChannelPrefix(body.To),
      status: kind,
      timestamp: new Date(),
      errorCode: body.ErrorCode,
      errorReason: body.ErrorMessage,
      pricing: body.Price
        ? {
            billable: true,
            currency: body.PriceUnit,
          }
        : undefined,
    };
  }

  private stripChannelPrefix(address: string | undefined): string {
    if (!address) return '';
    return address.replace(/^whatsapp:/i, '').replace(/^sms:/i, '').replace(/^\+/, '');
  }

  private mapStatus(status: TwilioMessageStatus): InboundStatusKind | null {
    switch (status) {
      case 'accepted':
      case 'queued':
      case 'sending':
      case 'sent':
        return InboundStatusKind.SENT;
      case 'delivered':
        return InboundStatusKind.DELIVERED;
      case 'read':
        return InboundStatusKind.READ;
      case 'failed':
      case 'undelivered':
        return InboundStatusKind.FAILED;
      case 'received':
      default:
        return null;
    }
  }

  private mapType(mimeType: string | undefined, body: string | undefined): MessageType {
    if (!mimeType) return body ? MessageType.TEXT : MessageType.UNKNOWN;
    if (mimeType.startsWith('image/')) return MessageType.IMAGE;
    if (mimeType.startsWith('video/')) return MessageType.VIDEO;
    if (mimeType.startsWith('audio/')) return MessageType.AUDIO;
    if (mimeType.startsWith('application/') || mimeType.startsWith('text/')) {
      return MessageType.DOCUMENT;
    }
    return MessageType.UNKNOWN;
  }
}

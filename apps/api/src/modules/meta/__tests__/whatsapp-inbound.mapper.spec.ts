import { describe, expect, it } from 'vitest';
import {
  InboundStatusKind,
  MessageType,
  ProviderType,
} from '@nexconnect/core';
import { WhatsAppInboundMapper } from '../whatsapp-cloud/whatsapp-inbound.mapper';
import { GraphWhatsAppChangeValue } from '../types/graph-api.types';

describe('WhatsAppInboundMapper', () => {
  const mapper = new WhatsAppInboundMapper();

  it('maps an incoming text message', () => {
    const value: GraphWhatsAppChangeValue = {
      messaging_product: 'whatsapp',
      metadata: { display_phone_number: '551199', phone_number_id: 'PHONE_ID' },
      contacts: [{ profile: { name: 'Alice' }, wa_id: '5511999' }],
      messages: [
        {
          from: '5511999',
          id: 'wamid.abc',
          timestamp: '1717000000',
          type: 'text',
          text: { body: 'Hello!' },
        },
      ],
    };
    const { messages, statuses, phoneNumberId } = mapper.mapValue(value);
    expect(phoneNumberId).toBe('PHONE_ID');
    expect(statuses).toHaveLength(0);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      provider: ProviderType.META_WHATSAPP_CLOUD,
      providerMessageId: 'wamid.abc',
      type: MessageType.TEXT,
      text: 'Hello!',
      contact: { profileName: 'Alice', waId: '5511999' },
    });
  });

  it('maps an image message with media metadata', () => {
    const value: GraphWhatsAppChangeValue = {
      messaging_product: 'whatsapp',
      metadata: { display_phone_number: '551199', phone_number_id: 'P' },
      messages: [
        {
          from: '5511999',
          id: 'wamid.img',
          timestamp: '1717000001',
          type: 'image',
          image: { id: 'media_id', mime_type: 'image/jpeg', sha256: 'abc', caption: 'cap' },
        } as never,
      ],
    };
    const { messages } = mapper.mapValue(value);
    expect(messages[0].media).toMatchObject({
      providerMediaId: 'media_id',
      mimeType: 'image/jpeg',
      sha256: 'abc',
      caption: 'cap',
    });
    expect(messages[0].type).toBe(MessageType.IMAGE);
  });

  it('maps button_reply interactive', () => {
    const value: GraphWhatsAppChangeValue = {
      messaging_product: 'whatsapp',
      metadata: { display_phone_number: '551199', phone_number_id: 'P' },
      messages: [
        {
          from: '5511999',
          id: 'wamid.btn',
          timestamp: '1717000002',
          type: 'interactive',
          interactive: {
            type: 'button_reply',
            button_reply: { id: 'yes', title: 'Yes' },
          },
        },
      ],
    };
    const { messages } = mapper.mapValue(value);
    expect(messages[0].interactive).toEqual({
      kind: 'button_reply',
      id: 'yes',
      title: 'Yes',
    });
    expect(messages[0].type).toBe(MessageType.BUTTON_REPLY);
  });

  it('maps delivered status', () => {
    const value: GraphWhatsAppChangeValue = {
      messaging_product: 'whatsapp',
      metadata: { display_phone_number: '551199', phone_number_id: 'P' },
      statuses: [
        {
          id: 'wamid.sent',
          status: 'delivered',
          timestamp: '1717000003',
          recipient_id: '5511999',
        },
      ],
    };
    const { statuses } = mapper.mapValue(value);
    expect(statuses).toHaveLength(1);
    expect(statuses[0].status).toBe(InboundStatusKind.DELIVERED);
  });

  it('maps failed status with error details', () => {
    const value: GraphWhatsAppChangeValue = {
      messaging_product: 'whatsapp',
      metadata: { display_phone_number: '551199', phone_number_id: 'P' },
      statuses: [
        {
          id: 'wamid.failed',
          status: 'failed',
          timestamp: '1717000004',
          recipient_id: '5511999',
          errors: [{ code: 131053, title: 'Recipient opted out' }],
        },
      ],
    };
    const { statuses } = mapper.mapValue(value);
    expect(statuses[0]).toMatchObject({
      status: InboundStatusKind.FAILED,
      errorCode: '131053',
      errorReason: 'Recipient opted out',
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  MessageType,
  ProviderType,
  ProviderUnsupportedOperationError,
  ProviderValidationError,
} from '@nexconnect/core';
import { TwilioMessagingMapper } from '../twilio-messaging.mapper';

describe('TwilioMessagingMapper', () => {
  const mapper = new TwilioMessagingMapper();

  it('builds an SMS text payload with explicit from', () => {
    const options = mapper.toCreateMessageOptions({
      message: { type: MessageType.TEXT, to: '+5511999998888', text: 'Hello' },
      channel: 'sms',
      from: '+12025550123',
      providerType: ProviderType.TWILIO_SMS,
    });
    expect(options).toMatchObject({
      to: '+5511999998888',
      from: '+12025550123',
      body: 'Hello',
    });
  });

  it('builds a WhatsApp text payload prefixing whatsapp:', () => {
    const options = mapper.toCreateMessageOptions({
      message: { type: MessageType.TEXT, to: '+5511999998888', text: 'Hi' },
      channel: 'whatsapp',
      from: '+14155238886',
      providerType: ProviderType.TWILIO_WHATSAPP,
    });
    expect(options.to).toBe('whatsapp:+5511999998888');
    expect(options.from).toBe('whatsapp:+14155238886');
  });

  it('uses messagingServiceSid if no from is provided', () => {
    const options = mapper.toCreateMessageOptions({
      message: { type: MessageType.TEXT, to: '+5511999998888', text: 'Hi' },
      channel: 'sms',
      messagingServiceSid: 'MGxxxxx',
      providerType: ProviderType.TWILIO_SMS,
    });
    expect(options.from).toBeUndefined();
    expect(options.messagingServiceSid).toBe('MGxxxxx');
  });

  it('rejects when neither from nor messagingServiceSid is provided', () => {
    expect(() =>
      mapper.toCreateMessageOptions({
        message: { type: MessageType.TEXT, to: '+5511999998888', text: 'Hi' },
        channel: 'sms',
        providerType: ProviderType.TWILIO_SMS,
      }),
    ).toThrow(ProviderValidationError);
  });

  it('maps media outbound to mediaUrl array', () => {
    const options = mapper.toCreateMessageOptions({
      message: {
        type: MessageType.IMAGE,
        to: '+5511999998888',
        media: { url: 'https://cdn.example.com/a.jpg', caption: 'pic' },
      },
      channel: 'whatsapp',
      from: '+14155238886',
      providerType: ProviderType.TWILIO_WHATSAPP,
    });
    expect(options.mediaUrl).toEqual(['https://cdn.example.com/a.jpg']);
    expect(options.body).toBe('pic');
  });

  it('rejects unsupported message types', () => {
    expect(() =>
      mapper.toCreateMessageOptions({
        message: { type: MessageType.REACTION, to: '+5511999998888', reaction: { messageId: 'x', emoji: '🎉' } },
        channel: 'sms',
        from: '+12025550123',
        providerType: ProviderType.TWILIO_SMS,
      }),
    ).toThrow(ProviderUnsupportedOperationError);
  });
});

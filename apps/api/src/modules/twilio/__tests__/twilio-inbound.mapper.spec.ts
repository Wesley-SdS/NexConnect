import { describe, expect, it } from 'vitest';
import {
  InboundStatusKind,
  MessageType,
  ProviderType,
} from '@nexconnect/core';
import { TwilioInboundMapper } from '../webhooks/twilio-inbound.mapper';

describe('TwilioInboundMapper', () => {
  const mapper = new TwilioInboundMapper();

  it('maps a WhatsApp inbound text', () => {
    const inbound = mapper.mapInboundMessage(
      {
        MessageSid: 'SMxxxx',
        AccountSid: 'ACxxxx',
        From: 'whatsapp:+5511999',
        To: 'whatsapp:+14155238886',
        Body: 'Olá',
        NumMedia: '0',
        ProfileName: 'Wesley',
        WaId: '5511999',
      },
      ProviderType.TWILIO_WHATSAPP,
    );
    expect(inbound).toMatchObject({
      provider: ProviderType.TWILIO_WHATSAPP,
      providerMessageId: 'SMxxxx',
      fromAddress: '5511999',
      toAddress: '14155238886',
      type: MessageType.TEXT,
      text: 'Olá',
      contact: { profileName: 'Wesley', waId: '5511999' },
    });
  });

  it('maps inbound media with mime type', () => {
    const inbound = mapper.mapInboundMessage(
      {
        MessageSid: 'SMmed',
        AccountSid: 'AC',
        From: '+5511999',
        To: '+12025550123',
        Body: '',
        NumMedia: '1',
        MediaUrl0: 'https://api.twilio.com/media/file.jpg',
        MediaContentType0: 'image/jpeg',
      } as never,
      ProviderType.TWILIO_SMS,
    );
    expect(inbound.media).toMatchObject({
      url: 'https://api.twilio.com/media/file.jpg',
      mimeType: 'image/jpeg',
    });
    expect(inbound.type).toBe(MessageType.IMAGE);
  });

  it('maps delivered status', () => {
    const update = mapper.mapStatusUpdate(
      {
        MessageSid: 'SMx',
        MessageStatus: 'delivered',
        From: 'whatsapp:+14155238886',
        To: 'whatsapp:+5511999',
        AccountSid: 'AC',
      },
      ProviderType.TWILIO_WHATSAPP,
    );
    expect(update?.status).toBe(InboundStatusKind.DELIVERED);
  });

  it('maps failed status with error details', () => {
    const update = mapper.mapStatusUpdate(
      {
        MessageSid: 'SMx',
        MessageStatus: 'failed',
        From: '+14155238886',
        To: '+5511999',
        AccountSid: 'AC',
        ErrorCode: '21614',
        ErrorMessage: "'To' number is not a valid mobile number",
      },
      ProviderType.TWILIO_SMS,
    );
    expect(update).toMatchObject({
      status: InboundStatusKind.FAILED,
      errorCode: '21614',
      errorReason: "'To' number is not a valid mobile number",
    });
  });

  it('returns null for "received" status which is not a delivery report', () => {
    const update = mapper.mapStatusUpdate(
      {
        MessageSid: 'SMx',
        MessageStatus: 'received',
        From: '+1',
        To: '+2',
        AccountSid: 'AC',
      },
      ProviderType.TWILIO_SMS,
    );
    expect(update).toBeNull();
  });
});

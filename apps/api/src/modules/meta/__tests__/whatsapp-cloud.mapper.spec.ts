import { describe, expect, it } from 'vitest';
import { MessageType, ProviderValidationError } from '@nexconnect/core';
import { WhatsAppCloudMapper } from '../whatsapp-cloud/whatsapp-cloud.mapper';

describe('WhatsAppCloudMapper', () => {
  const mapper = new WhatsAppCloudMapper();

  it('builds a text message payload', () => {
    const payload = mapper.toGraphPayload({
      type: MessageType.TEXT,
      to: '+5511999998888',
      text: 'Hello!',
    });
    expect(payload).toMatchObject({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '5511999998888',
      type: 'text',
      text: { body: 'Hello!', preview_url: false },
    });
  });

  it('includes context when replying', () => {
    const payload = mapper.toGraphPayload({
      type: MessageType.TEXT,
      to: '+5511999998888',
      text: 'Reply',
      context: { messageId: 'wamid.origin' },
    });
    expect(payload).toMatchObject({ context: { message_id: 'wamid.origin' } });
  });

  it('builds an image payload using uploaded id', () => {
    const payload = mapper.toGraphPayload({
      type: MessageType.IMAGE,
      to: '5511000000000',
      media: { id: 'media_123', caption: 'cap' },
    });
    expect(payload).toMatchObject({
      type: 'image',
      image: { id: 'media_123', caption: 'cap' },
    });
  });

  it('builds a document payload using link', () => {
    const payload = mapper.toGraphPayload({
      type: MessageType.DOCUMENT,
      to: '5511000000000',
      media: { url: 'https://cdn.example.com/file.pdf', filename: 'file.pdf' },
    });
    expect(payload).toMatchObject({
      type: 'document',
      document: { link: 'https://cdn.example.com/file.pdf', filename: 'file.pdf' },
    });
  });

  it('builds an interactive buttons payload', () => {
    const payload = mapper.toGraphPayload({
      type: MessageType.BUTTON_REPLY,
      to: '5511000000000',
      body: 'Pick one',
      buttons: [
        { id: 'yes', title: 'Yes' },
        { id: 'no', title: 'No' },
      ],
    });
    expect(payload).toMatchObject({
      type: 'interactive',
      interactive: {
        type: 'button',
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'yes', title: 'Yes' } },
            { type: 'reply', reply: { id: 'no', title: 'No' } },
          ],
        },
      },
    });
  });

  it('builds an interactive list payload', () => {
    const payload = mapper.toGraphPayload({
      type: MessageType.LIST_REPLY,
      to: '5511000000000',
      body: 'Menu',
      button: 'Options',
      sections: [
        {
          title: 'Main',
          rows: [
            { id: 'r1', title: 'Row 1', description: 'first' },
            { id: 'r2', title: 'Row 2' },
          ],
        },
      ],
    });
    expect(payload).toMatchObject({
      type: 'interactive',
      interactive: { type: 'list', action: { button: 'Options' } },
    });
  });

  it('refuses interactive with more than 3 buttons', () => {
    expect(() =>
      mapper.toGraphPayload({
        type: MessageType.BUTTON_REPLY,
        to: '5511000000000',
        body: 'Pick',
        buttons: [
          { id: '1', title: 'a' },
          { id: '2', title: 'b' },
          { id: '3', title: 'c' },
          { id: '4', title: 'd' },
        ],
      }),
    ).toThrow(ProviderValidationError);
  });

  it('builds a reaction payload', () => {
    const payload = mapper.toGraphPayload({
      type: MessageType.REACTION,
      to: '5511000000000',
      reaction: { messageId: 'wamid.origin', emoji: '🎉' },
    });
    expect(payload).toMatchObject({
      type: 'reaction',
      reaction: { message_id: 'wamid.origin', emoji: '🎉' },
    });
  });

  it('builds a template payload', () => {
    const payload = mapper.toGraphPayload({
      type: MessageType.TEMPLATE,
      to: '5511000000000',
      template: {
        name: 'welcome',
        language: 'pt_BR',
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', value: 'Wesley' }],
          },
        ],
      },
    });
    expect(payload).toMatchObject({
      type: 'template',
      template: {
        name: 'welcome',
        language: { code: 'pt_BR' },
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: 'Wesley' }],
          },
        ],
      },
    });
  });

  it('rejects media without url or id', () => {
    expect(() =>
      mapper.toGraphPayload({
        type: MessageType.IMAGE,
        to: '5511000000000',
        media: {},
      }),
    ).toThrow(ProviderValidationError);
  });
});

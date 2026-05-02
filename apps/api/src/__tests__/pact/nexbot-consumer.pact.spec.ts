import { describe, it, expect } from 'vitest';
import { PactV4, MatchersV3 } from '@pact-foundation/pact';
import { resolve } from 'path';

const { string, integer, boolean, datetime } = MatchersV3;

// ISO 8601 datetime with milliseconds — Pact v3 dropped the named helper, so
// we keep a small wrapper to preserve the readability of the contract above.
const iso8601DateTimeWithMillis = () =>
  datetime("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", '2026-01-15T12:34:56.789Z');

const provider = new PactV4({
  consumer: 'NexBot',
  provider: 'NexConnect',
  dir: resolve(__dirname, '../../pacts'),
});

describe('NexBot <-> NexConnect Contract', () => {
  it('should deliver inbound message webhook with correct payload', async () => {
    await provider
      .addInteraction()
      .given('an active instance exists')
      .uponReceiving('an inbound text message webhook')
      .withRequest('POST', '/api/channels/whatsapp/inbound/ins_001', (builder) => {
        builder
          .headers({
            'Content-Type': 'application/json',
            'X-NexConnect-Signature': string('sha256=abc123'),
            'X-NexConnect-Event': string('message.received'),
            'X-NexConnect-Delivery-Id': string(),
            'X-NexConnect-Timestamp': string(),
          })
          .jsonBody({
            id: string(),
            type: 'message.received',
            instance_id: string('ins_001'),
            tenant_id: string(),
            created_at: iso8601DateTimeWithMillis(),
            data: {
              message_id: string(),
              type: 'text',
              from: string('+5511999998888'),
              from_name: string('Joao Silva'),
              is_group: boolean(false),
              content: {
                text: string('Ola, preciso de ajuda'),
              },
              buffered_messages: integer(1),
              sent_at: iso8601DateTimeWithMillis(),
            },
            meta: {
              delivery_attempt: integer(1),
              replay: boolean(false),
            },
          });
      })
      .willRespondWith(200, (builder) => {
        builder.jsonBody({ received: true });
      })
      .executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/channels/whatsapp/inbound/ins_001`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-NexConnect-Signature': 'sha256=abc123',
            'X-NexConnect-Event': 'message.received',
            'X-NexConnect-Delivery-Id': 'evt_01HZ',
            'X-NexConnect-Timestamp': new Date().toISOString(),
          },
          body: JSON.stringify({
            id: 'evt_01HZ',
            type: 'message.received',
            instance_id: 'ins_001',
            tenant_id: 'ten_001',
            created_at: new Date().toISOString(),
            data: {
              message_id: 'msg_001',
              type: 'text',
              from: '+5511999998888',
              from_name: 'Joao Silva',
              is_group: false,
              content: { text: 'Ola, preciso de ajuda' },
              buffered_messages: 1,
              sent_at: new Date().toISOString(),
            },
            meta: { delivery_attempt: 1, replay: false },
          }),
        });

        expect(response.status).toBe(200);
      });
  });

  it('should deliver audio message with transcription', async () => {
    await provider
      .addInteraction()
      .given('an active instance with STT enabled')
      .uponReceiving('an inbound audio message webhook')
      .withRequest('POST', '/api/channels/whatsapp/inbound/ins_001', (builder) => {
        builder
          .headers({ 'Content-Type': 'application/json' })
          .jsonBody({
            id: string(),
            type: 'message.received',
            instance_id: string(),
            tenant_id: string(),
            created_at: iso8601DateTimeWithMillis(),
            data: {
              message_id: string(),
              type: 'audio',
              from: string(),
              from_name: string(),
              is_group: boolean(false),
              content: {
                transcription: string('Transcricao do audio'),
                media_url: string('https://r2.nexconnect.io/media/audio.ogg'),
              },
              buffered_messages: integer(1),
              sent_at: iso8601DateTimeWithMillis(),
            },
            meta: { delivery_attempt: integer(1), replay: boolean(false) },
          });
      })
      .willRespondWith(200)
      .executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/channels/whatsapp/inbound/ins_001`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 'evt_02',
            type: 'message.received',
            instance_id: 'ins_001',
            tenant_id: 'ten_001',
            created_at: new Date().toISOString(),
            data: {
              message_id: 'msg_002',
              type: 'audio',
              from: '+5511999998888',
              from_name: 'Joao Silva',
              is_group: false,
              content: {
                transcription: 'Transcricao do audio',
                media_url: 'https://r2.nexconnect.io/media/audio.ogg',
              },
              buffered_messages: 1,
              sent_at: new Date().toISOString(),
            },
            meta: { delivery_attempt: 1, replay: false },
          }),
        });
        expect(response.status).toBe(200);
      });
  });
});

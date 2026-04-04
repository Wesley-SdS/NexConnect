import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NexConnect } from '../client';
import { InstancesResource } from '../resources/instances.resource';
import { MessagesResource } from '../resources/messages.resource';
import { WebhooksResource } from '../resources/webhooks.resource';
import { GroupsResource } from '../resources/groups.resource';
import { BroadcastsResource } from '../resources/broadcasts.resource';
import { SchedulingResource } from '../resources/scheduling.resource';
import { SandboxResource } from '../resources/sandbox.resource';

describe('NexConnect Client', () => {
  it('should throw if apiKey is not provided', () => {
    expect(() => new NexConnect({ apiKey: '' })).toThrow('apiKey is required');
  });

  it('should create an instance with valid apiKey', () => {
    const client = new NexConnect({ apiKey: 'nex_test_abc123' });
    expect(client).toBeDefined();
  });

  it('should expose all resource properties', () => {
    const client = new NexConnect({ apiKey: 'nex_test_abc123' });

    expect(client.instances).toBeInstanceOf(InstancesResource);
    expect(client.messages).toBeInstanceOf(MessagesResource);
    expect(client.webhooks).toBeInstanceOf(WebhooksResource);
    expect(client.groups).toBeInstanceOf(GroupsResource);
    expect(client.broadcasts).toBeInstanceOf(BroadcastsResource);
    expect(client.scheduling).toBeInstanceOf(SchedulingResource);
    expect(client.sandbox).toBeInstanceOf(SandboxResource);
  });

  it('should accept custom baseUrl and timeout', () => {
    const client = new NexConnect({
      apiKey: 'nex_test_abc123',
      baseUrl: 'http://localhost:3000/v1',
      timeout: 5000,
      maxRetries: 1,
    });
    expect(client).toBeDefined();
  });
});

describe('NexConnect Retry Behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should retry on 5xx errors up to maxRetries', async () => {
    const { request } = await import('undici');
    const mockedRequest = vi.mocked(request);

    let callCount = 0;

    mockedRequest.mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) {
        return {
          statusCode: 503,
          headers: {},
          body: {
            text: async () => JSON.stringify({ message: 'Service Unavailable' }),
          },
        } as any;
      }
      return {
        statusCode: 200,
        headers: {},
        body: {
          text: async () => JSON.stringify({ id: 'inst_123', name: 'Test', status: 'CONNECTED' }),
        },
      } as any;
    });

    const client = new NexConnect({
      apiKey: 'nex_test_abc123',
      baseUrl: 'http://localhost:3000/v1',
      maxRetries: 3,
    });

    const result = await client.instances.get('inst_123');
    expect(result).toEqual({ id: 'inst_123', name: 'Test', status: 'CONNECTED' });
    expect(callCount).toBe(3);
  });
});

vi.mock('undici', () => ({
  request: vi.fn(),
}));

import { HttpClient } from './http-client';
import { InstancesResource } from './resources/instances.resource';
import { MessagesResource } from './resources/messages.resource';
import { WebhooksResource } from './resources/webhooks.resource';
import { GroupsResource } from './resources/groups.resource';
import { BroadcastsResource } from './resources/broadcasts.resource';
import { SchedulingResource } from './resources/scheduling.resource';
import { SandboxResource } from './resources/sandbox.resource';
import type { NexConnectOptions } from './types';

const DEFAULT_BASE_URL = 'https://api.nexconnect.io/v1';
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 3;

/**
 * Main entry point for the NexConnect SDK.
 *
 * @example
 * ```ts
 * const nex = new NexConnect({ apiKey: 'nex_live_...' });
 *
 * const instance = await nex.instances.create({ name: 'My Bot' });
 * const qr = await nex.instances.getQrCode(instance.id);
 *
 * await nex.messages.send(instance.id, {
 *   to: '+5511999999999',
 *   type: 'text',
 *   content: { text: 'Hello from NexConnect!' },
 * });
 * ```
 */
export class NexConnect {
  readonly instances: InstancesResource;
  readonly messages: MessagesResource;
  readonly webhooks: WebhooksResource;
  readonly groups: GroupsResource;
  readonly broadcasts: BroadcastsResource;
  readonly scheduling: SchedulingResource;
  readonly sandbox: SandboxResource;

  private readonly httpClient: HttpClient;

  constructor(options: NexConnectOptions) {
    if (!options.apiKey) {
      throw new Error('apiKey is required to initialize NexConnect');
    }

    this.httpClient = new HttpClient({
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      apiKey: options.apiKey,
      timeout: options.timeout ?? DEFAULT_TIMEOUT,
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    });

    this.instances = new InstancesResource(this.httpClient);
    this.messages = new MessagesResource(this.httpClient);
    this.webhooks = new WebhooksResource(this.httpClient);
    this.groups = new GroupsResource(this.httpClient);
    this.broadcasts = new BroadcastsResource(this.httpClient);
    this.scheduling = new SchedulingResource(this.httpClient);
    this.sandbox = new SandboxResource(this.httpClient);
  }
}

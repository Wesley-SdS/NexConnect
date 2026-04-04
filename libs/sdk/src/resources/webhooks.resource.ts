import { HttpClient } from '../http-client';
import type {
  Webhook,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  ReplayEventsRequest,
} from '../types';

export class WebhooksResource {
  constructor(private readonly http: HttpClient) {}

  async create(instanceId: string, data: CreateWebhookRequest): Promise<Webhook> {
    return this.http.post<Webhook>(`/instances/${instanceId}/webhooks`, { body: data });
  }

  async update(instanceId: string, webhookId: string, data: UpdateWebhookRequest): Promise<Webhook> {
    return this.http.patch<Webhook>(`/instances/${instanceId}/webhooks/${webhookId}`, { body: data });
  }

  async delete(instanceId: string, webhookId: string): Promise<void> {
    await this.http.delete(`/instances/${instanceId}/webhooks/${webhookId}`);
  }

  async test(instanceId: string, webhookId: string): Promise<void> {
    await this.http.post(`/instances/${instanceId}/webhooks/${webhookId}/test`);
  }

  async replayEvents(params: ReplayEventsRequest): Promise<void> {
    const { instanceId, webhookId, ...body } = params;
    await this.http.post(`/instances/${instanceId}/webhooks/${webhookId}/replay`, { body });
  }
}

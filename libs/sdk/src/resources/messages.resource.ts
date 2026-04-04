import { HttpClient } from '../http-client';
import type {
  Message,
  SendMessageRequest,
  ListMessagesParams,
  PaginatedResponse,
} from '../types';

export class MessagesResource {
  constructor(private readonly http: HttpClient) {}

  async send(instanceId: string, data: SendMessageRequest): Promise<Message> {
    return this.http.post<Message>(`/instances/${instanceId}/messages`, { body: data });
  }

  async list(instanceId: string, params?: ListMessagesParams): Promise<PaginatedResponse<Message>> {
    return this.http.get<PaginatedResponse<Message>>(`/instances/${instanceId}/messages`, {
      query: params as Record<string, string | number | boolean | undefined>,
    });
  }

  async get(instanceId: string, msgId: string): Promise<Message> {
    return this.http.get<Message>(`/instances/${instanceId}/messages/${msgId}`);
  }

  async react(instanceId: string, msgId: string, emoji: string): Promise<void> {
    await this.http.post(`/instances/${instanceId}/messages/${msgId}/react`, {
      body: { emoji },
    });
  }

  async removeReaction(instanceId: string, msgId: string): Promise<void> {
    await this.http.delete(`/instances/${instanceId}/messages/${msgId}/react`);
  }
}

import { HttpClient } from '../http-client';
import type {
  SandboxSession,
  CreateSandboxSessionRequest,
  SimulateInboundRequest,
  SimulateWebhookRequest,
  WebhookPayload,
} from '../types';

export class SandboxResource {
  constructor(private readonly http: HttpClient) {}

  async createSession(data: CreateSandboxSessionRequest): Promise<SandboxSession> {
    return this.http.post<SandboxSession>('/sandbox/sessions', { body: data });
  }

  async listSessions(): Promise<SandboxSession[]> {
    return this.http.get<SandboxSession[]>('/sandbox/sessions');
  }

  async deleteSession(id: string): Promise<void> {
    await this.http.delete(`/sandbox/sessions/${id}`);
  }

  async simulateInbound(data: SimulateInboundRequest): Promise<WebhookPayload> {
    return this.http.post<WebhookPayload>('/sandbox/simulate/inbound', { body: data });
  }

  async simulateWebhook(data: SimulateWebhookRequest): Promise<void> {
    await this.http.post('/sandbox/simulate/webhook', { body: data });
  }
}

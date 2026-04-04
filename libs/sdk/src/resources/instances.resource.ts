import { HttpClient } from '../http-client';
import type {
  Instance,
  CreateInstanceRequest,
  UpdateInstanceRequest,
  ListInstancesParams,
  PaginatedResponse,
  QrCodeResponse,
  PairingCodeResponse,
  HealthResponse,
  MetricsResponse,
} from '../types';

export class InstancesResource {
  constructor(private readonly http: HttpClient) {}

  async create(data: CreateInstanceRequest): Promise<Instance> {
    return this.http.post<Instance>('/instances', { body: data });
  }

  async list(params?: ListInstancesParams): Promise<PaginatedResponse<Instance>> {
    return this.http.get<PaginatedResponse<Instance>>('/instances', {
      query: params as Record<string, string | number | boolean | undefined>,
    });
  }

  async get(id: string): Promise<Instance> {
    return this.http.get<Instance>(`/instances/${id}`);
  }

  async update(id: string, data: UpdateInstanceRequest): Promise<Instance> {
    return this.http.patch<Instance>(`/instances/${id}`, { body: data });
  }

  async delete(id: string): Promise<void> {
    await this.http.delete(`/instances/${id}`);
  }

  async getQrCode(id: string): Promise<QrCodeResponse> {
    return this.http.get<QrCodeResponse>(`/instances/${id}/qrcode`);
  }

  async getPairingCode(id: string, phone: string): Promise<PairingCodeResponse> {
    return this.http.post<PairingCodeResponse>(`/instances/${id}/pairing-code`, {
      body: { phone },
    });
  }

  async powerOn(id: string): Promise<void> {
    await this.http.post(`/instances/${id}/power-on`);
  }

  async powerOff(id: string): Promise<void> {
    await this.http.post(`/instances/${id}/power-off`);
  }

  async restart(id: string): Promise<void> {
    await this.http.post(`/instances/${id}/restart`);
  }

  async getHealth(id: string): Promise<HealthResponse> {
    return this.http.get<HealthResponse>(`/instances/${id}/health`);
  }

  async getMetrics(id: string, period?: string): Promise<MetricsResponse> {
    return this.http.get<MetricsResponse>(`/instances/${id}/metrics`, {
      query: period ? { period } : undefined,
    });
  }
}

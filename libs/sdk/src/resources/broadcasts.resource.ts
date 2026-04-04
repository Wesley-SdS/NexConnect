import { HttpClient } from '../http-client';
import type {
  Broadcast,
  CreateBroadcastRequest,
  ListBroadcastsParams,
  PaginatedResponse,
} from '../types';

export class BroadcastsResource {
  constructor(private readonly http: HttpClient) {}

  async create(data: CreateBroadcastRequest): Promise<Broadcast> {
    return this.http.post<Broadcast>('/broadcasts', { body: data });
  }

  async list(params?: ListBroadcastsParams): Promise<PaginatedResponse<Broadcast>> {
    return this.http.get<PaginatedResponse<Broadcast>>('/broadcasts', {
      query: params as Record<string, string | number | boolean | undefined>,
    });
  }

  async get(id: string): Promise<Broadcast> {
    return this.http.get<Broadcast>(`/broadcasts/${id}`);
  }
}

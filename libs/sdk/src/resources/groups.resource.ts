import { HttpClient } from '../http-client';
import type {
  Group,
  CreateGroupRequest,
  UpdateGroupRequest,
} from '../types';

export class GroupsResource {
  constructor(private readonly http: HttpClient) {}

  async create(instanceId: string, data: CreateGroupRequest): Promise<Group> {
    return this.http.post<Group>(`/instances/${instanceId}/groups`, { body: data });
  }

  async list(instanceId: string): Promise<Group[]> {
    return this.http.get<Group[]>(`/instances/${instanceId}/groups`);
  }

  async get(instanceId: string, groupId: string): Promise<Group> {
    return this.http.get<Group>(`/instances/${instanceId}/groups/${groupId}`);
  }

  async update(instanceId: string, groupId: string, data: UpdateGroupRequest): Promise<Group> {
    return this.http.patch<Group>(`/instances/${instanceId}/groups/${groupId}`, { body: data });
  }

  async leave(instanceId: string, groupId: string): Promise<void> {
    await this.http.post(`/instances/${instanceId}/groups/${groupId}/leave`);
  }

  async addParticipants(instanceId: string, groupId: string, phones: string[]): Promise<void> {
    await this.http.post(`/instances/${instanceId}/groups/${groupId}/participants/add`, {
      body: { phones },
    });
  }

  async removeParticipants(instanceId: string, groupId: string, phones: string[]): Promise<void> {
    await this.http.post(`/instances/${instanceId}/groups/${groupId}/participants/remove`, {
      body: { phones },
    });
  }

  async promoteParticipants(instanceId: string, groupId: string, phones: string[]): Promise<void> {
    await this.http.post(`/instances/${instanceId}/groups/${groupId}/participants/promote`, {
      body: { phones },
    });
  }

  async demoteParticipants(instanceId: string, groupId: string, phones: string[]): Promise<void> {
    await this.http.post(`/instances/${instanceId}/groups/${groupId}/participants/demote`, {
      body: { phones },
    });
  }
}

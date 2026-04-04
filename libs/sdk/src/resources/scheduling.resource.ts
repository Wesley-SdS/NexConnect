import { HttpClient } from '../http-client';
import type {
  ScheduledMessage,
  CreateScheduledMessageRequest,
  CronJob,
  CreateCronJobRequest,
} from '../types';

export class SchedulingResource {
  constructor(private readonly http: HttpClient) {}

  async createMessage(data: CreateScheduledMessageRequest): Promise<ScheduledMessage> {
    return this.http.post<ScheduledMessage>('/scheduling/messages', { body: data });
  }

  async listMessages(instanceId?: string): Promise<ScheduledMessage[]> {
    return this.http.get<ScheduledMessage[]>('/scheduling/messages', {
      query: instanceId ? { instanceId } : undefined,
    });
  }

  async deleteMessage(id: string): Promise<void> {
    await this.http.delete(`/scheduling/messages/${id}`);
  }

  async createCronJob(data: CreateCronJobRequest): Promise<CronJob> {
    return this.http.post<CronJob>('/scheduling/cron-jobs', { body: data });
  }

  async listCronJobs(instanceId?: string): Promise<CronJob[]> {
    return this.http.get<CronJob[]>('/scheduling/cron-jobs', {
      query: instanceId ? { instanceId } : undefined,
    });
  }

  async deleteCronJob(id: string): Promise<void> {
    await this.http.delete(`/scheduling/cron-jobs/${id}`);
  }
}

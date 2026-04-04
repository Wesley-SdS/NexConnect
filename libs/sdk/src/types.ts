// ─── Enums ───────────────────────────────────────────────────────────────────

export type InstanceStatus = 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'BANNED';
export type InstanceType = 'QR_CODE' | 'PAIRING_CODE';
export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'contact' | 'reaction';
export type MessageDirection = 'inbound' | 'outbound';
export type WebhookEvent =
  | 'message.received'
  | 'message.sent'
  | 'message.delivered'
  | 'message.read'
  | 'message.failed'
  | 'instance.connected'
  | 'instance.disconnected'
  | 'group.join'
  | 'group.leave';

export type BroadcastStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type ScheduledMessageStatus = 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
export type CronJobStatus = 'ACTIVE' | 'PAUSED' | 'DELETED';

// ─── Core Models ─────────────────────────────────────────────────────────────

export interface Instance {
  id: string;
  name: string;
  type: InstanceType;
  status: InstanceStatus;
  phoneNumber: string | null;
  profileName: string | null;
  profilePictureUrl: string | null;
  webhooksCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  instanceId: string;
  remoteJid: string;
  direction: MessageDirection;
  type: MessageType;
  content: MessageContent;
  timestamp: string;
  status: string;
  createdAt: string;
}

export interface MessageContent {
  text?: string;
  caption?: string;
  url?: string;
  mimetype?: string;
  filename?: string;
  latitude?: number;
  longitude?: number;
  contactName?: string;
  contactPhone?: string;
  emoji?: string;
}

export interface Webhook {
  id: string;
  instanceId: string;
  url: string;
  events: WebhookEvent[];
  headers: Record<string, string>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: string;
  instanceId: string;
  groupJid: string;
  name: string;
  description: string | null;
  pictureUrl: string | null;
  participants: GroupParticipant[];
  createdAt: string;
}

export interface GroupParticipant {
  jid: string;
  role: 'admin' | 'superadmin' | 'member';
}

export interface Broadcast {
  id: string;
  name: string;
  instanceId: string;
  status: BroadcastStatus;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  message: SendMessageRequest;
  recipients: string[];
  createdAt: string;
  completedAt: string | null;
}

export interface ScheduledMessage {
  id: string;
  instanceId: string;
  scheduledAt: string;
  status: ScheduledMessageStatus;
  message: SendMessageRequest;
  createdAt: string;
}

export interface CronJob {
  id: string;
  instanceId: string;
  cronExpression: string;
  status: CronJobStatus;
  message: SendMessageRequest;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
}

export interface SandboxSession {
  id: string;
  instanceId: string;
  phoneNumber: string;
  expiresAt: string;
  createdAt: string;
}

export interface WebhookPayload {
  event: WebhookEvent;
  instanceId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// ─── Request Interfaces ──────────────────────────────────────────────────────

export interface CreateInstanceRequest {
  name: string;
  type?: InstanceType;
}

export interface UpdateInstanceRequest {
  name?: string;
}

export interface SendMessageRequest {
  to: string;
  type: MessageType;
  content: MessageContent;
}

export interface CreateWebhookRequest {
  url: string;
  events: WebhookEvent[];
  headers?: Record<string, string>;
  active?: boolean;
}

export interface UpdateWebhookRequest {
  url?: string;
  events?: WebhookEvent[];
  headers?: Record<string, string>;
  active?: boolean;
}

export interface CreateGroupRequest {
  name: string;
  participants: string[];
  description?: string;
}

export interface UpdateGroupRequest {
  name?: string;
  description?: string;
}

export interface CreateBroadcastRequest {
  name: string;
  instanceId: string;
  message: SendMessageRequest;
  recipients: string[];
}

export interface CreateScheduledMessageRequest {
  instanceId: string;
  scheduledAt: string;
  message: SendMessageRequest;
}

export interface CreateCronJobRequest {
  instanceId: string;
  cronExpression: string;
  message: SendMessageRequest;
}

export interface CreateSandboxSessionRequest {
  instanceId: string;
  phoneNumber: string;
}

export interface SimulateInboundRequest {
  sessionId: string;
  from: string;
  type: MessageType;
  content: MessageContent;
}

export interface SimulateWebhookRequest {
  sessionId: string;
  event: WebhookEvent;
  data?: Record<string, unknown>;
}

export interface ReplayEventsRequest {
  instanceId: string;
  webhookId: string;
  fromDate: string;
  toDate?: string;
  events?: WebhookEvent[];
}

// ─── Response Interfaces ─────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface ListInstancesParams extends PaginationParams {
  status?: InstanceStatus;
}

export interface ListMessagesParams extends PaginationParams {
  direction?: MessageDirection;
  type?: MessageType;
  from?: string;
  to?: string;
}

export interface ListBroadcastsParams extends PaginationParams {
  status?: BroadcastStatus;
}

export interface QrCodeResponse {
  qrCode: string;
  expiresAt: string;
}

export interface PairingCodeResponse {
  code: string;
  expiresAt: string;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  lastHeartbeat: string;
  details: Record<string, unknown>;
}

export interface MetricsResponse {
  instanceId: string;
  period: string;
  messagesSent: number;
  messagesReceived: number;
  messagesFailed: number;
  averageResponseTime: number;
  webhookDeliveries: number;
  webhookFailures: number;
}

// ─── SDK Options ─────────────────────────────────────────────────────────────

export interface NexConnectOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export { NexConnect } from './client';
export { HttpClient } from './http-client';
export type { HttpClientOptions } from './http-client';

// Errors
export {
  NexConnectApiError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  mapHttpError,
} from './errors';
export type { ValidationFieldError } from './errors';

// Resources
export { InstancesResource } from './resources/instances.resource';
export { MessagesResource } from './resources/messages.resource';
export { WebhooksResource } from './resources/webhooks.resource';
export { GroupsResource } from './resources/groups.resource';
export { BroadcastsResource } from './resources/broadcasts.resource';
export { SchedulingResource } from './resources/scheduling.resource';
export { SandboxResource } from './resources/sandbox.resource';
export { ProvidersResource } from './resources/providers.resource';
export type {
  ProviderType,
  ProviderCredentialStatus,
  ProviderCredential,
  CredentialPayload,
  MetaWhatsAppCloudCredentials,
  MetaInstagramCredentials,
  MetaMessengerCredentials,
  TwilioCredentials,
  TelegramCredentials,
  DiscordCredentials,
  SlackCredentials,
  CreateCredentialRequest,
  UpdateCredentialRequest,
  ListCredentialsParams,
} from './resources/providers.resource';

// Types
export type {
  // Enums / Unions
  InstanceStatus,
  InstanceType,
  MessageType,
  MessageDirection,
  WebhookEvent,
  BroadcastStatus,
  ScheduledMessageStatus,
  CronJobStatus,
  // Models
  Instance,
  Message,
  MessageContent,
  Webhook,
  Group,
  GroupParticipant,
  Broadcast,
  ScheduledMessage,
  CronJob,
  SandboxSession,
  WebhookPayload,
  // Requests
  CreateInstanceRequest,
  UpdateInstanceRequest,
  SendMessageRequest,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  CreateGroupRequest,
  UpdateGroupRequest,
  CreateBroadcastRequest,
  CreateScheduledMessageRequest,
  CreateCronJobRequest,
  CreateSandboxSessionRequest,
  SimulateInboundRequest,
  SimulateWebhookRequest,
  ReplayEventsRequest,
  // Responses
  PaginatedResponse,
  PaginationMeta,
  PaginationParams,
  ListInstancesParams,
  ListMessagesParams,
  ListBroadcastsParams,
  QrCodeResponse,
  PairingCodeResponse,
  HealthResponse,
  MetricsResponse,
  NexConnectOptions,
} from './types';

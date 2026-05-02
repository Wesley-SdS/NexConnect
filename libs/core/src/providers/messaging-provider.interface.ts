import { OutboundMessage } from './outbound-message.dto';
import {
  ProviderMediaDownloadResult,
  ProviderMediaUploadResult,
  ProviderSendResult,
} from './provider-result';
import {
  ProviderCapability,
  ProviderChannel,
  ProviderType,
} from './provider-type.enum';

export interface ProviderContext {
  tenantId: string;
  instanceId: string;
  credentialId: string;
  correlationId?: string;
}

export interface MediaUploadInput {
  buffer: Buffer;
  mimeType: string;
  filename?: string;
}

export interface ProviderHealth {
  ok: boolean;
  latencyMs?: number;
  detail?: string;
}

/**
 * Capabilities marked optional are gated behind ProviderCapability flags.
 * Callers MUST check `provider.supports(capability)` before invoking the
 * corresponding method to avoid runtime failures on providers that do not
 * implement that capability.
 */
export interface IMessagingProvider {
  readonly type: ProviderType;
  readonly channel: ProviderChannel;
  readonly capabilities: ReadonlySet<ProviderCapability>;

  supports(capability: ProviderCapability): boolean;

  send(context: ProviderContext, message: OutboundMessage): Promise<ProviderSendResult>;

  markAsRead?(context: ProviderContext, externalMessageId: string): Promise<void>;

  setTypingIndicator?(
    context: ProviderContext,
    externalMessageId: string,
    state: 'on' | 'off',
  ): Promise<void>;

  uploadMedia?(context: ProviderContext, input: MediaUploadInput): Promise<ProviderMediaUploadResult>;

  downloadMedia?(context: ProviderContext, providerMediaId: string): Promise<ProviderMediaDownloadResult>;

  editMessage?(
    context: ProviderContext,
    externalMessageId: string,
    message: OutboundMessage,
  ): Promise<ProviderSendResult>;

  deleteMessage?(context: ProviderContext, externalMessageId: string): Promise<void>;

  addReaction?(
    context: ProviderContext,
    externalMessageId: string,
    emoji: string,
  ): Promise<void>;

  removeReaction?(
    context: ProviderContext,
    externalMessageId: string,
    emoji: string,
  ): Promise<void>;

  /** Lightweight liveness check (e.g. Telegram getMe, Slack auth.test, Meta /me). */
  ping?(context: ProviderContext): Promise<ProviderHealth>;
}

/**
 * Optional companion contract for provider-specific lifecycle operations
 * triggered when a credential is created / rotated / revoked. Implementations
 * use this to register webhooks, slash commands, subscribe to apps, etc.
 */
export interface IProviderLifecycle {
  onCredentialCreated?(context: ProviderContext): Promise<void>;
  onCredentialRotated?(context: ProviderContext): Promise<void>;
  onCredentialRevoked?(context: ProviderContext): Promise<void>;
}

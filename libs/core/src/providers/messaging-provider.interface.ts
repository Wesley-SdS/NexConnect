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
}

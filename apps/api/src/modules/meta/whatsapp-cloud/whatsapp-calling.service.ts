import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  MetaWhatsAppCloudCredentials,
  ProviderError,
  ProviderType,
} from '@nexconnect/core';
import { HttpClient } from '@nexconnect/shared';
import {
  CREDENTIAL_RESOLVER,
  CredentialResolver,
} from '../../providers/credential.resolver';
import { MetaErrorMapper } from '../shared/meta-error.mapper';
import { MetaHttpClientFactory } from '../shared/meta-http-client.factory';

export interface ConnectCallInput {
  /** E.164 destination phone number (no leading +). */
  to: string;
  /** Optional SDP offer for WebRTC; if absent, Meta will create one. */
  sdpOffer?: string;
}

export interface CallResource {
  id: string;
  status: string;
}

/**
 * WhatsApp Business Calling API. Lets the business initiate or accept
 * voice calls associated with a phone_number_id.
 * https://developers.facebook.com/docs/whatsapp/cloud-api/calls
 */
@Injectable()
export class WhatsAppCallingService {
  private readonly logger = new Logger(WhatsAppCallingService.name);

  constructor(
    private readonly httpFactory: MetaHttpClientFactory,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  async connectCall(credentialId: string, input: ConnectCallInput): Promise<CallResource> {
    const creds = await this.resolveCreds(credentialId);
    const client = this.client(creds);

    const body: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to: input.to,
      action: 'connect',
    };
    if (input.sdpOffer) body.session = { sdp_type: 'offer', sdp: input.sdpOffer };

    const response = await client.post<CallResource>(`${creds.phoneNumberId}/calls`, body);
    if (!response.ok) {
      throw MetaErrorMapper.from(ProviderType.META_WHATSAPP_CLOUD, response.status, response.data);
    }
    this.logger.log({ credentialId, callId: response.data.id }, 'meta.calling.connect');
    return response.data;
  }

  async acceptCall(credentialId: string, callId: string, sdpAnswer: string): Promise<void> {
    const creds = await this.resolveCreds(credentialId);
    const client = this.client(creds);
    const response = await client.post(`${creds.phoneNumberId}/calls`, {
      messaging_product: 'whatsapp',
      call_id: callId,
      action: 'accept',
      session: { sdp_type: 'answer', sdp: sdpAnswer },
    });
    if (!response.ok) {
      throw MetaErrorMapper.from(ProviderType.META_WHATSAPP_CLOUD, response.status, response.data);
    }
  }

  async rejectCall(credentialId: string, callId: string, reason?: string): Promise<void> {
    const creds = await this.resolveCreds(credentialId);
    const client = this.client(creds);
    const response = await client.post(`${creds.phoneNumberId}/calls`, {
      messaging_product: 'whatsapp',
      call_id: callId,
      action: 'reject',
      reason,
    });
    if (!response.ok) {
      throw MetaErrorMapper.from(ProviderType.META_WHATSAPP_CLOUD, response.status, response.data);
    }
  }

  async terminateCall(credentialId: string, callId: string): Promise<void> {
    const creds = await this.resolveCreds(credentialId);
    const client = this.client(creds);
    const response = await client.post(`${creds.phoneNumberId}/calls`, {
      messaging_product: 'whatsapp',
      call_id: callId,
      action: 'terminate',
    });
    if (!response.ok) {
      throw MetaErrorMapper.from(ProviderType.META_WHATSAPP_CLOUD, response.status, response.data);
    }
  }

  // ─── private ─────────────────────────────────────────

  private async resolveCreds(credentialId: string): Promise<MetaWhatsAppCloudCredentials> {
    const data = await this.credentials.resolve(credentialId);
    if (data.type !== ProviderType.META_WHATSAPP_CLOUD) {
      throw new ProviderError(
        ProviderType.META_WHATSAPP_CLOUD,
        'CREDENTIAL_TYPE_MISMATCH',
        `Credential ${credentialId} is not a Meta WhatsApp Cloud credential`,
        false,
      );
    }
    return data;
  }

  private client(creds: MetaWhatsAppCloudCredentials): HttpClient {
    return this.httpFactory.create({
      accessToken: creds.accessToken,
      apiVersion: creds.graphApiVersion,
    });
  }
}

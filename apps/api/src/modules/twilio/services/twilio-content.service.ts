import { Inject, Injectable, Logger } from '@nestjs/common';
import { ProviderError, ProviderType } from '@nexconnect/core';
import {
  CREDENTIAL_RESOLVER,
  CredentialResolver,
} from '../../providers/credential.resolver';
import { TwilioClientFactory } from '../twilio-client.factory';
import { TwilioErrorMapper } from '../twilio-error.mapper';

export interface ContentTemplateInput {
  friendly_name: string;
  language: string;
  variables?: Record<string, string>;
  types: Record<string, unknown>; // e.g., { 'twilio/text': { body: 'Hello {{1}}' } }
}

/**
 * Twilio Content API templates. Lets the tenant create / list /
 * fetch / delete reusable rich templates that can be referenced
 * by ContentSid when sending via Messages API.
 *
 * https://www.twilio.com/docs/content
 */
@Injectable()
export class TwilioContentService {
  private readonly logger = new Logger(TwilioContentService.name);

  constructor(
    private readonly factory: TwilioClientFactory,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  async createTemplate(
    credentialId: string,
    input: ContentTemplateInput,
  ): Promise<{ sid: string; status: string; friendly_name: string }> {
    const creds = await this.credentials.resolveTwilio(credentialId);
    const client = this.factory.fromCredentials(creds);
    try {
      const created = await client.content.v1.contents.create(input);
      this.logger.log(
        { sid: created.sid, friendlyName: created.friendlyName },
        'twilio.content.created',
      );
      return {
        sid: created.sid,
        status: 'pending',
        friendly_name: created.friendlyName ?? input.friendly_name,
      };
    } catch (err) {
      throw TwilioErrorMapper.from(ProviderType.TWILIO_WHATSAPP, err);
    }
  }

  async submitForApproval(
    credentialId: string,
    contentSid: string,
    input: { name: string; category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY' },
  ): Promise<void> {
    const creds = await this.credentials.resolveTwilio(credentialId);
    const client = this.factory.fromCredentials(creds);
    try {
      await client.content.v1
        .contents(contentSid)
        .approvalCreate.create({ name: input.name, category: input.category });
    } catch (err) {
      throw TwilioErrorMapper.from(ProviderType.TWILIO_WHATSAPP, err);
    }
  }

  async listTemplates(credentialId: string, pageSize = 50) {
    const creds = await this.credentials.resolveTwilio(credentialId);
    const client = this.factory.fromCredentials(creds);
    try {
      const list = await client.content.v1.contents.list({ pageSize });
      return list.map((c) => ({
        sid: c.sid,
        friendly_name: c.friendlyName,
        language: c.language,
        date_created: c.dateCreated,
      }));
    } catch (err) {
      throw TwilioErrorMapper.from(ProviderType.TWILIO_WHATSAPP, err);
    }
  }

  async fetchTemplate(credentialId: string, contentSid: string) {
    const creds = await this.credentials.resolveTwilio(credentialId);
    const client = this.factory.fromCredentials(creds);
    try {
      const content = await client.content.v1.contents(contentSid).fetch();
      return {
        sid: content.sid,
        friendly_name: content.friendlyName,
        language: content.language,
        types: content.types,
        variables: content.variables,
      };
    } catch (err) {
      throw TwilioErrorMapper.from(ProviderType.TWILIO_WHATSAPP, err);
    }
  }

  async deleteTemplate(credentialId: string, contentSid: string): Promise<void> {
    const creds = await this.credentials.resolveTwilio(credentialId);
    const client = this.factory.fromCredentials(creds);
    try {
      await client.content.v1.contents(contentSid).remove();
    } catch (err) {
      throw TwilioErrorMapper.from(ProviderType.TWILIO_WHATSAPP, err);
    }
  }

  /**
   * Resolves a tenant-friendly name to the corresponding ContentSid by
   * paginating Twilio's list endpoint. Used by the messaging mapper
   * when callers send `template.name` instead of `template.contentSid`.
   */
  async resolveSidByName(credentialId: string, name: string): Promise<string | null> {
    const list = await this.listTemplates(credentialId, 100);
    const match = list.find((t) => t.friendly_name === name);
    return match?.sid ?? null;
  }
}

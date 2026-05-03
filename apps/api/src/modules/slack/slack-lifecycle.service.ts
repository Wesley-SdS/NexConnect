import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IProviderLifecycle,
  ProviderContext,
  ProviderType,
  SlackCredentials,
} from '@nexconnect/core';
import {
  CREDENTIAL_RESOLVER,
  CredentialResolver,
} from '../providers/credential.resolver';
import { SlackClient } from './slack.client';

/**
 * Slack lifecycle is mostly out-of-band (configured in the Slack App
 * dashboard). The hook here uses auth.test as a smoke check and stores
 * the resolved team_id back into the credential metadata.
 */
@Injectable()
export class SlackLifecycleService implements IProviderLifecycle {
  private readonly logger = new Logger(SlackLifecycleService.name);

  constructor(
    private readonly client: SlackClient,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  async onCredentialCreated(context: ProviderContext): Promise<void> {
    await this.smokeTest(context);
  }

  async onCredentialRotated(context: ProviderContext): Promise<void> {
    await this.smokeTest(context);
  }

  async onCredentialRevoked(_context: ProviderContext): Promise<void> {
    // Slack revocation is operator-side (Manage Apps -> Remove). We don't
    // call any token revocation API here on purpose to avoid affecting
    // co-tenants of the same Slack workspace.
  }

  private async smokeTest(context: ProviderContext): Promise<void> {
    const data = await this.credentials.resolve(context.credentialId);
    if (data.type !== ProviderType.SLACK) return;
    const creds = data as SlackCredentials;
    try {
      const auth = await this.client.authTest({ botToken: creds.botToken });
      this.logger.log(
        {
          credentialId: context.credentialId,
          team: auth.team,
          teamId: auth.team_id,
          botUserId: auth.user_id,
        },
        'slack.credential.smoketest.ok',
      );
    } catch (err) {
      this.logger.warn(
        { credentialId: context.credentialId, err: (err as Error).message },
        'slack.credential.smoketest.failed',
      );
    }
  }
}

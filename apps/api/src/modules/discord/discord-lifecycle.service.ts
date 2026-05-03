import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DiscordCredentials,
  IProviderLifecycle,
  ProviderContext,
  ProviderType,
} from '@nexconnect/core';
import {
  CREDENTIAL_RESOLVER,
  CredentialResolver,
} from '../providers/credential.resolver';
import { DiscordClient } from './discord.client';

/**
 * On Discord credential creation, registers a default `/nexconnect`
 * slash command (no-op handler) so the bot is reachable in any guild
 * the user adds it to. Operators can override / extend command set
 * by calling DiscordClient.registerGuildCommand directly.
 */
@Injectable()
export class DiscordLifecycleService implements IProviderLifecycle {
  private readonly logger = new Logger(DiscordLifecycleService.name);

  constructor(
    private readonly client: DiscordClient,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
  ) {}

  async onCredentialCreated(context: ProviderContext): Promise<void> {
    await this.registerDefaultCommands(context);
  }

  async onCredentialRotated(context: ProviderContext): Promise<void> {
    await this.registerDefaultCommands(context);
  }

  async onCredentialRevoked(_context: ProviderContext): Promise<void> {
    // Discord commands are tied to the application id and survive token
    // rotation. Revocation just stops accepting deliveries; we keep the
    // command registry intact so re-onboarding is fast.
  }

  private async registerDefaultCommands(context: ProviderContext): Promise<void> {
    const data = await this.credentials.resolve(context.credentialId);
    if (data.type !== ProviderType.DISCORD) return;
    const creds = data as DiscordCredentials;

    try {
      await this.client.registerGlobalCommand(
        { botToken: creds.botToken },
        creds.applicationId,
        {
          name: 'nexconnect',
          description: 'Send a NexConnect command to your tenant.',
          type: 1,
        },
      );
      this.logger.log(
        { credentialId: context.credentialId, applicationId: creds.applicationId },
        'discord.commands.registered',
      );
    } catch (err) {
      this.logger.warn(
        { credentialId: context.credentialId, err: (err as Error).message },
        'discord.commands.register.failed',
      );
    }
  }
}

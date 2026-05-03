import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  IProviderLifecycle,
  ProviderContext,
  ProviderType,
} from '@nexconnect/core';
import { MetaCredentialLifecycle } from '../meta/shared/meta-lifecycle.service';
import { TelegramLifecycleService } from '../telegram/telegram-lifecycle.service';
import { DiscordLifecycleService } from '../discord/discord-lifecycle.service';
import { SlackLifecycleService } from '../slack/slack-lifecycle.service';

/**
 * Dispatches credential lifecycle events to the right provider hook.
 * Each underlying lifecycle service is injected as Optional so the
 * orchestrator works even in deployments where a particular provider
 * module isn't loaded.
 */
@Injectable()
export class ProviderLifecycleOrchestrator {
  private readonly logger = new Logger(ProviderLifecycleOrchestrator.name);
  private readonly hooks: Partial<Record<ProviderType, IProviderLifecycle>>;

  constructor(
    @Optional() meta?: MetaCredentialLifecycle,
    @Optional() telegram?: TelegramLifecycleService,
    @Optional() discord?: DiscordLifecycleService,
    @Optional() slack?: SlackLifecycleService,
  ) {
    this.hooks = {
      [ProviderType.META_WHATSAPP_CLOUD]: meta,
      [ProviderType.META_INSTAGRAM]: meta,
      [ProviderType.META_MESSENGER]: meta,
      [ProviderType.TELEGRAM]: telegram,
      [ProviderType.DISCORD]: discord,
      [ProviderType.SLACK]: slack,
    };
  }

  async fireCreated(provider: ProviderType, context: ProviderContext): Promise<void> {
    const hook = this.hooks[provider];
    if (!hook?.onCredentialCreated) return;
    try {
      await hook.onCredentialCreated(context);
    } catch (err) {
      this.logger.warn(
        { provider, credentialId: context.credentialId, err: (err as Error).message },
        'lifecycle.created.failed',
      );
    }
  }

  async fireRotated(provider: ProviderType, context: ProviderContext): Promise<void> {
    const hook = this.hooks[provider];
    if (!hook?.onCredentialRotated) return;
    try {
      await hook.onCredentialRotated(context);
    } catch (err) {
      this.logger.warn(
        { provider, credentialId: context.credentialId, err: (err as Error).message },
        'lifecycle.rotated.failed',
      );
    }
  }

  async fireRevoked(provider: ProviderType, context: ProviderContext): Promise<void> {
    const hook = this.hooks[provider];
    if (!hook?.onCredentialRevoked) return;
    try {
      await hook.onCredentialRevoked(context);
    } catch (err) {
      this.logger.warn(
        { provider, credentialId: context.credentialId, err: (err as Error).message },
        'lifecycle.revoked.failed',
      );
    }
  }
}

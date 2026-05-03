import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { WhatsAppCloudProvider } from '../meta/whatsapp-cloud/whatsapp-cloud.provider';
import { InstagramProvider } from '../meta/instagram/instagram.provider';
import { MessengerProvider } from '../meta/messenger/messenger.provider';
import {
  TwilioSmsProvider,
  TwilioWhatsAppProvider,
} from '../twilio/twilio-messaging.provider';
import { TelegramProvider } from '../telegram/telegram.provider';
import { DiscordProvider } from '../discord/discord.provider';
import { SlackProvider } from '../slack/slack.provider';
import { ProviderRegistry } from './provider-registry.service';
import { ProviderCredentialService } from './provider-credential.service';
import { ProviderLifecycleOrchestrator } from './provider-lifecycle.orchestrator';

/**
 * Runtime glue: pulls every registered IMessagingProvider implementation
 * out of the Nest container and plugs it into the ProviderRegistry so the
 * outbound pipeline can resolve by ProviderType without knowing about
 * concrete classes.
 */
@Injectable()
export class ProviderRegistrar implements OnModuleInit {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly registry: ProviderRegistry,
    private readonly credentialService: ProviderCredentialService,
    private readonly lifecycle: ProviderLifecycleOrchestrator,
  ) {}

  onModuleInit(): void {
    this.credentialService.setLifecycleOrchestrator(this.lifecycle);

    const candidates: Array<new (...args: never[]) => unknown> = [
      WhatsAppCloudProvider,
      InstagramProvider,
      MessengerProvider,
      TwilioSmsProvider,
      TwilioWhatsAppProvider,
      TelegramProvider,
      DiscordProvider,
      SlackProvider,
    ];
    for (const Cls of candidates) {
      try {
        const provider = this.moduleRef.get(Cls, { strict: false });
        if (provider) this.registry.register(provider as never);
      } catch {
        // Provider not available in this deployment (e.g. Meta disabled) — skip silently
      }
    }
  }
}

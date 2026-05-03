import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '@nexconnect/database';
import { MetaModule } from '../meta/meta.module';
import { TwilioModule } from '../twilio/twilio.module';
import { TelegramModule } from '../telegram/telegram.module';
import { DiscordModule } from '../discord/discord.module';
import { SlackModule } from '../slack/slack.module';
import { MediaModule } from '../media/media.module';
import { ProvidersController } from './providers.controller';
import { CredentialEncryptionService } from './credential-encryption.service';
import { ProviderCredentialService } from './provider-credential.service';
import { ProviderRegistry } from './provider-registry.service';
import { ProviderRegistrar } from './provider-registrar.service';
import { ProviderDispatcherService } from './provider-dispatcher.service';
import { ProviderMediaIngestionService } from './provider-media-ingestion.service';
import { ConversationPricingService } from './conversation-pricing.service';
import { ProviderLifecycleOrchestrator } from './provider-lifecycle.orchestrator';
import { TemplateBindingValidator } from './template-binding.validator';
import { CREDENTIAL_RESOLVER } from './credential.resolver';

@Module({
  imports: [
    DatabaseModule,
    MediaModule,
    forwardRef(() => MetaModule),
    forwardRef(() => TwilioModule),
    forwardRef(() => TelegramModule),
    forwardRef(() => DiscordModule),
    forwardRef(() => SlackModule),
  ],
  controllers: [ProvidersController],
  providers: [
    CredentialEncryptionService,
    ProviderCredentialService,
    ProviderRegistry,
    ProviderRegistrar,
    ProviderDispatcherService,
    ProviderMediaIngestionService,
    ConversationPricingService,
    ProviderLifecycleOrchestrator,
    TemplateBindingValidator,
    {
      provide: CREDENTIAL_RESOLVER,
      useExisting: ProviderCredentialService,
    },
  ],
  exports: [
    CredentialEncryptionService,
    ProviderCredentialService,
    ProviderRegistry,
    ProviderDispatcherService,
    ProviderMediaIngestionService,
    ConversationPricingService,
    ProviderLifecycleOrchestrator,
    TemplateBindingValidator,
    CREDENTIAL_RESOLVER,
  ],
})
export class ProvidersModule {}

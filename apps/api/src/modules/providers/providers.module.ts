import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '@nexconnect/database';
import { MetaModule } from '../meta/meta.module';
import { TwilioModule } from '../twilio/twilio.module';
import { MediaModule } from '../media/media.module';
import { ProvidersController } from './providers.controller';
import { CredentialEncryptionService } from './credential-encryption.service';
import { ProviderCredentialService } from './provider-credential.service';
import { ProviderRegistry } from './provider-registry.service';
import { ProviderRegistrar } from './provider-registrar.service';
import { ProviderDispatcherService } from './provider-dispatcher.service';
import { ProviderMediaIngestionService } from './provider-media-ingestion.service';
import { CREDENTIAL_RESOLVER } from './credential.resolver';

@Module({
  imports: [
    DatabaseModule,
    MediaModule,
    forwardRef(() => MetaModule),
    forwardRef(() => TwilioModule),
  ],
  controllers: [ProvidersController],
  providers: [
    CredentialEncryptionService,
    ProviderCredentialService,
    ProviderRegistry,
    ProviderRegistrar,
    ProviderDispatcherService,
    ProviderMediaIngestionService,
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
    CREDENTIAL_RESOLVER,
  ],
})
export class ProvidersModule {}

import { Injectable, Logger } from '@nestjs/common';
import { IMessagingProvider, ProviderType } from '@nexconnect/core';

/**
 * Dependency-inverted lookup: modules register their IMessagingProvider
 * implementations, and callers (messages pipeline, API) resolve by
 * ProviderType. Keeps the outbound pipeline independent from concrete
 * SDKs and the Twilio/Meta modules independent from the pipeline.
 */
@Injectable()
export class ProviderRegistry {
  private readonly logger = new Logger(ProviderRegistry.name);
  private readonly registry = new Map<ProviderType, IMessagingProvider>();

  register(provider: IMessagingProvider): void {
    if (this.registry.has(provider.type)) {
      this.logger.warn({ type: provider.type }, 'provider.registry.overwrite');
    }
    this.registry.set(provider.type, provider);
    this.logger.log({ type: provider.type, channel: provider.channel }, 'provider.registered');
  }

  resolve(type: ProviderType): IMessagingProvider {
    const provider = this.registry.get(type);
    if (!provider) {
      throw new Error(`No messaging provider registered for ${type}`);
    }
    return provider;
  }

  has(type: ProviderType): boolean {
    return this.registry.has(type);
  }

  list(): IMessagingProvider[] {
    return Array.from(this.registry.values());
  }
}

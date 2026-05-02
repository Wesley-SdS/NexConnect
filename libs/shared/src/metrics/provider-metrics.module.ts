import { Global, Module } from '@nestjs/common';
import { ProviderMetricsService } from './provider-metrics.service';

@Global()
@Module({
  providers: [ProviderMetricsService],
  exports: [ProviderMetricsService],
})
export class ProviderMetricsModule {}

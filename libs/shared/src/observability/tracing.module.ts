import {
  Global,
  Module,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { TracingService } from './tracing.service';
import { RequestLogger } from './request-logger.service';

@Global()
@Module({
  providers: [TracingService, RequestLogger],
  exports: [TracingService, RequestLogger],
})
export class TracingModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly tracingService: TracingService) {}

  async onModuleInit(): Promise<void> {
    await this.tracingService.initialize();
  }

  async onModuleDestroy(): Promise<void> {
    await this.tracingService.shutdown();
  }
}

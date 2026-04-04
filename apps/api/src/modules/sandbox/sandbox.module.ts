import { Module } from '@nestjs/common';
import { DatabaseModule } from '@nexconnect/database';
import { RedisModule } from '@nexconnect/redis';
import { SandboxController } from './sandbox.controller';
import { SandboxService } from './sandbox.service';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [DatabaseModule, RedisModule, WebhooksModule],
  controllers: [SandboxController],
  providers: [SandboxService],
  exports: [SandboxService],
})
export class SandboxModule {}

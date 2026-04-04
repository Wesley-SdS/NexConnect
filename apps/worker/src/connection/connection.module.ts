import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BaileysConnectionService } from './baileys-connection.service';
import { ConnectionPoolService } from './connection-pool.service';
import { SessionPersistenceService } from './session-persistence.service';
import { ReconnectionService } from './reconnection.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'inbound-messages' })],
  providers: [
    BaileysConnectionService,
    ConnectionPoolService,
    SessionPersistenceService,
    ReconnectionService,
  ],
  exports: [
    BaileysConnectionService,
    ConnectionPoolService,
    SessionPersistenceService,
    ReconnectionService,
  ],
})
export class ConnectionModule {}

import { Module } from '@nestjs/common';
import { BaileysConnectionService } from './baileys-connection.service';
import { ConnectionPoolService } from './connection-pool.service';
import { SessionPersistenceService } from './session-persistence.service';
import { ReconnectionService } from './reconnection.service';

@Module({
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

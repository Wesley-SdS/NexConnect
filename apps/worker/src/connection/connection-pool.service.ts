import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InstanceSettings, InstanceStatus } from '@nexconnect/core';
import { MAX_INSTANCES_PER_POD } from '@nexconnect/shared';
import { BaileysConnectionService } from './baileys-connection.service';
import { SessionPersistenceService } from './session-persistence.service';
import { ReconnectionService } from './reconnection.service';

interface ManagedInstance {
  id: string;
  settings: InstanceSettings;
  status: InstanceStatus;
  connectedAt: number | null;
}

@Injectable()
export class ConnectionPoolService {
  private readonly logger = new Logger(ConnectionPoolService.name);
  private readonly instances = new Map<string, ManagedInstance>();

  constructor(
    private readonly baileysConnection: BaileysConnectionService,
    private readonly sessionPersistence: SessionPersistenceService,
    private readonly reconnection: ReconnectionService,
  ) {}

  async addInstance(
    id: string,
    settings: InstanceSettings,
  ): Promise<void> {
    if (this.instances.size >= MAX_INSTANCES_PER_POD) {
      throw new Error(
        `Pod capacity reached (${MAX_INSTANCES_PER_POD}). Cannot add instance ${id}`,
      );
    }

    if (this.instances.has(id)) {
      this.logger.warn('Instance already managed, replacing', {
        instanceId: id,
      });
      await this.removeInstance(id);
    }

    this.logger.log('Adding instance to pool', { instanceId: id });

    const managedInstance: ManagedInstance = {
      id,
      settings,
      status: InstanceStatus.CONNECTING,
      connectedAt: null,
    };

    this.instances.set(id, managedInstance);

    const authState = await this.sessionPersistence.loadAuthState(id);

    if (authState) {
      await this.baileysConnection.connect(id, authState);
    } else {
      this.logger.log('No existing auth state, awaiting QR/pairing', {
        instanceId: id,
      });
      this.updateInstanceStatus(id, InstanceStatus.WAITING_QR);
    }
  }

  async removeInstance(id: string): Promise<void> {
    const instance = this.instances.get(id);
    if (!instance) {
      this.logger.warn('Instance not found in pool', { instanceId: id });
      return;
    }

    this.logger.log('Removing instance from pool', { instanceId: id });

    this.reconnection.cancelReconnection(id);
    await this.baileysConnection.disconnect(id);
    this.instances.delete(id);
  }

  getInstance(id: string): ManagedInstance | undefined {
    return this.instances.get(id);
  }

  getActiveCount(): number {
    return Array.from(this.instances.values()).filter(
      (i) => i.status === InstanceStatus.CONNECTED,
    ).length;
  }

  getAll(): ManagedInstance[] {
    return Array.from(this.instances.values());
  }

  @OnEvent('connection.open')
  handleConnectionOpen(payload: {
    instanceId: string;
    status: InstanceStatus;
  }): void {
    this.updateInstanceStatus(payload.instanceId, InstanceStatus.CONNECTED);
    const instance = this.instances.get(payload.instanceId);
    if (instance) {
      instance.connectedAt = Date.now();
    }
    this.reconnection.resetAttempts(payload.instanceId);
  }

  @OnEvent('connection.closed')
  async handleConnectionClosed(payload: {
    instanceId: string;
    statusCode: number;
    shouldReconnect: boolean;
  }): Promise<void> {
    this.updateInstanceStatus(
      payload.instanceId,
      InstanceStatus.DISCONNECTED,
    );

    if (!payload.shouldReconnect) {
      this.logger.log('Instance logged out, not reconnecting', {
        instanceId: payload.instanceId,
        statusCode: payload.statusCode,
      });
      return;
    }

    const instance = this.instances.get(payload.instanceId);
    if (!instance) {
      return;
    }

    await this.reconnection.scheduleReconnection(
      payload.instanceId,
      async () => {
        const authState = await this.sessionPersistence.loadAuthState(
          payload.instanceId,
        );
        if (authState) {
          this.updateInstanceStatus(
            payload.instanceId,
            InstanceStatus.CONNECTING,
          );
          await this.baileysConnection.connect(
            payload.instanceId,
            authState,
          );
        }
      },
    );
  }

  @OnEvent('connection.creds-updated')
  async handleCredsUpdated(payload: {
    instanceId: string;
  }): Promise<void> {
    this.logger.debug('Credentials updated, persisting', {
      instanceId: payload.instanceId,
    });
  }

  private updateInstanceStatus(
    instanceId: string,
    status: InstanceStatus,
  ): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.status = status;
      this.logger.log('Instance status updated', { instanceId, status });
    }
  }
}

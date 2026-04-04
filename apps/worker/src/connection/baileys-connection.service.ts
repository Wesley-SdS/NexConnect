import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import makeWASocket, {
  DisconnectReason,
  WASocket,
  ConnectionState,
  AuthenticationState,
  proto,
  BaileysEventMap,
} from '@whiskeysockets/baileys';
import { InstanceStatus } from '@nexconnect/core';
import { UlidUtil } from '@nexconnect/shared';

interface ActiveSocket {
  socket: WASocket;
  instanceId: string;
  qrCode: string | null;
}

@Injectable()
export class BaileysConnectionService implements OnModuleDestroy {
  private readonly logger = new Logger(BaileysConnectionService.name);
  private readonly sockets = new Map<string, ActiveSocket>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue('inbound-messages')
    private readonly inboundQueue: Queue,
  ) {}

  async onModuleDestroy(): Promise<void> {
    const disconnectPromises = Array.from(this.sockets.keys()).map((id) =>
      this.disconnect(id),
    );
    await Promise.allSettled(disconnectPromises);
  }

  async connect(
    instanceId: string,
    authState: AuthenticationState,
  ): Promise<void> {
    if (this.sockets.has(instanceId)) {
      this.logger.warn('Connection already exists, disconnecting first', {
        instanceId,
      });
      await this.disconnect(instanceId);
    }

    this.logger.log('Creating Baileys connection', { instanceId });

    const socket = makeWASocket({
      auth: authState,
      printQRInTerminal: false,
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
    });

    const activeSocket: ActiveSocket = {
      socket,
      instanceId,
      qrCode: null,
    };

    this.sockets.set(instanceId, activeSocket);

    this.registerEventHandlers(instanceId, socket);
  }

  async disconnect(instanceId: string): Promise<void> {
    const activeSocket = this.sockets.get(instanceId);
    if (!activeSocket) {
      this.logger.warn('No active connection to disconnect', { instanceId });
      return;
    }

    this.logger.log('Disconnecting Baileys socket', { instanceId });

    activeSocket.socket.end(undefined);
    this.sockets.delete(instanceId);

    this.eventEmitter.emit('connection.disconnected', { instanceId });
  }

  async sendMessage(
    instanceId: string,
    jid: string,
    content: proto.IMessage,
  ): Promise<proto.WebMessageInfo | undefined> {
    const activeSocket = this.getSocket(instanceId);

    this.logger.debug('Sending message', { instanceId, jid });

    return activeSocket.socket.sendMessage(jid, content);
  }

  getQrCode(instanceId: string): string | null {
    const activeSocket = this.sockets.get(instanceId);
    return activeSocket?.qrCode ?? null;
  }

  async getPairingCode(
    instanceId: string,
    phoneNumber: string,
  ): Promise<string> {
    const activeSocket = this.getSocket(instanceId);

    this.logger.log('Requesting pairing code', { instanceId, phoneNumber });

    return activeSocket.socket.requestPairingCode(phoneNumber);
  }

  isConnected(instanceId: string): boolean {
    return this.sockets.has(instanceId);
  }

  private getSocket(instanceId: string): ActiveSocket {
    const activeSocket = this.sockets.get(instanceId);
    if (!activeSocket) {
      throw new Error(`No active connection for instance ${instanceId}`);
    }
    return activeSocket;
  }

  private registerEventHandlers(
    instanceId: string,
    socket: WASocket,
  ): void {
    socket.ev.on(
      'connection.update',
      (update: Partial<ConnectionState>) => {
        this.handleConnectionUpdate(instanceId, update);
      },
    );

    socket.ev.on('creds.update', () => {
      this.eventEmitter.emit('connection.creds-updated', { instanceId });
    });

    socket.ev.on(
      'messages.upsert',
      (event: BaileysEventMap['messages.upsert']) => {
        this.handleMessagesUpsert(instanceId, event);
      },
    );

    socket.ev.on(
      'messages.update',
      (updates: BaileysEventMap['messages.update']) => {
        this.handleMessagesUpdate(instanceId, updates);
      },
    );
  }

  private handleConnectionUpdate(
    instanceId: string,
    update: Partial<ConnectionState>,
  ): void {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      const activeSocket = this.sockets.get(instanceId);
      if (activeSocket) {
        activeSocket.qrCode = qr;
      }
      this.eventEmitter.emit('connection.qr', { instanceId, qr });
      this.logger.log('QR code generated', { instanceId });
    }

    if (connection === 'close') {
      const statusCode =
        (lastDisconnect?.error as any)?.output?.statusCode ??
        DisconnectReason.connectionLost;

      this.logger.warn('Connection closed', { instanceId, statusCode });

      this.sockets.delete(instanceId);

      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut &&
        statusCode !== DisconnectReason.forbidden;

      this.eventEmitter.emit('connection.closed', {
        instanceId,
        statusCode,
        shouldReconnect,
      });
    }

    if (connection === 'open') {
      this.logger.log('Connection established', { instanceId });

      const activeSocket = this.sockets.get(instanceId);
      if (activeSocket) {
        activeSocket.qrCode = null;
      }

      this.eventEmitter.emit('connection.open', {
        instanceId,
        status: InstanceStatus.CONNECTED,
      });
    }
  }

  private async handleMessagesUpsert(
    instanceId: string,
    event: BaileysEventMap['messages.upsert'],
  ): Promise<void> {
    if (event.type !== 'notify') {
      return;
    }

    for (const message of event.messages) {
      if (message.key.fromMe) {
        continue;
      }

      if (!message.message) {
        continue;
      }

      this.logger.debug('Inbound message received', {
        instanceId,
        messageId: message.key.id,
        remoteJid: message.key.remoteJid,
      });

      await this.inboundQueue.add(
        'process-message',
        {
          id: UlidUtil.generate(),
          instanceId,
          rawMessage: message,
          receivedAt: Date.now(),
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );
    }
  }

  private handleMessagesUpdate(
    instanceId: string,
    updates: BaileysEventMap['messages.update'],
  ): void {
    for (const update of updates) {
      this.eventEmitter.emit('message.status-update', {
        instanceId,
        messageId: update.key.id,
        remoteJid: update.key.remoteJid,
        status: update.update?.status,
      });
    }
  }
}

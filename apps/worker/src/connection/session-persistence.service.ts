import { Injectable, Logger } from '@nestjs/common';
import { AuthenticationState } from '@whiskeysockets/baileys';
import { PrismaService } from '@nexconnect/database';
import { CryptoUtil } from '@nexconnect/shared';

@Injectable()
export class SessionPersistenceService {
  private readonly logger = new Logger(SessionPersistenceService.name);
  private readonly encryptionKey: string;

  constructor(private readonly prisma: PrismaService) {
    this.encryptionKey =
      process.env.SESSION_ENCRYPTION_KEY ?? 'default-key-change-in-production';
  }

  async saveAuthState(
    instanceId: string,
    state: AuthenticationState,
  ): Promise<void> {
    this.logger.debug('Saving auth state', { instanceId });

    const serialized = JSON.stringify(state);
    const encrypted = CryptoUtil.encrypt(
      Buffer.from(serialized, 'utf-8'),
      this.encryptionKey,
    );

    await this.prisma.instance.update({
      where: { id: instanceId },
      data: { authStateEncrypted: new Uint8Array(encrypted) },
    });

    this.logger.log('Auth state saved', { instanceId });
  }

  async loadAuthState(
    instanceId: string,
  ): Promise<AuthenticationState | null> {
    this.logger.debug('Loading auth state', { instanceId });

    const instance = await this.prisma.instance.findUnique({
      where: { id: instanceId },
      select: { authStateEncrypted: true },
    });

    if (!instance?.authStateEncrypted) {
      this.logger.debug('No auth state found', { instanceId });
      return null;
    }

    const decrypted = CryptoUtil.decrypt(
      Buffer.from(instance.authStateEncrypted),
      this.encryptionKey,
    ).toString('utf-8');

    this.logger.log('Auth state loaded', { instanceId });

    return JSON.parse(decrypted) as AuthenticationState;
  }

  async deleteAuthState(instanceId: string): Promise<void> {
    this.logger.log('Deleting auth state', { instanceId });

    await this.prisma.instance.update({
      where: { id: instanceId },
      data: { authStateEncrypted: null },
    });
  }
}

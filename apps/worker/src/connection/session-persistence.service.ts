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
    const encrypted = CryptoUtil.encrypt(serialized, this.encryptionKey);

    await this.prisma.$executeRaw`
      INSERT INTO session_auth_states (instance_id, encrypted_state, updated_at)
      VALUES (${instanceId}, ${encrypted}, NOW())
      ON CONFLICT (instance_id)
      DO UPDATE SET encrypted_state = ${encrypted}, updated_at = NOW()
    `;

    this.logger.log('Auth state saved', { instanceId });
  }

  async loadAuthState(
    instanceId: string,
  ): Promise<AuthenticationState | null> {
    this.logger.debug('Loading auth state', { instanceId });

    const result = await this.prisma.$queryRaw<
      Array<{ encrypted_state: string }>
    >`
      SELECT encrypted_state FROM session_auth_states
      WHERE instance_id = ${instanceId}
    `;

    if (!result || result.length === 0) {
      this.logger.debug('No auth state found', { instanceId });
      return null;
    }

    const decrypted = CryptoUtil.decrypt(
      result[0].encrypted_state,
      this.encryptionKey,
    );

    this.logger.log('Auth state loaded', { instanceId });

    return JSON.parse(decrypted) as AuthenticationState;
  }

  async deleteAuthState(instanceId: string): Promise<void> {
    this.logger.log('Deleting auth state', { instanceId });

    await this.prisma.$executeRaw`
      DELETE FROM session_auth_states WHERE instance_id = ${instanceId}
    `;
  }
}

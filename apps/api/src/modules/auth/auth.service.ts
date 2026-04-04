import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@nexconnect/database';
import { CryptoUtil, UlidUtil } from '@nexconnect/shared';

interface ValidatedApiKey {
  tenant: { id: string; name: string; plan: string };
  scopes: string[];
  apiKeyId: string;
}

interface CreatedApiKey {
  key: string;
  id: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async validateApiKey(rawKey: string): Promise<ValidatedApiKey> {
    const hashedKey = CryptoUtil.hashApiKey(rawKey);

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { hashedKey },
      include: {
        tenant: {
          select: { id: true, name: true, plan: true, status: true },
        },
      },
    });

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (apiKey.revokedAt) {
      throw new UnauthorizedException('API key has been revoked');
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    if (apiKey.tenant.status !== 'active') {
      throw new UnauthorizedException('Tenant account is not active');
    }

    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      tenant: {
        id: apiKey.tenant.id,
        name: apiKey.tenant.name,
        plan: apiKey.tenant.plan,
      },
      scopes: apiKey.scopes,
      apiKeyId: apiKey.id,
    };
  }

  async createApiKey(
    tenantId: string,
    name: string,
    scopes: string[],
  ): Promise<CreatedApiKey> {
    const rawKey = CryptoUtil.generateApiKey();
    const hashedKey = CryptoUtil.hashApiKey(rawKey);
    const id = UlidUtil.generate();

    await this.prisma.apiKey.create({
      data: {
        id,
        name,
        hashedKey,
        prefix: rawKey.substring(0, 8),
        scopes,
        tenantId,
      },
    });

    return { key: rawKey, id };
  }

  async revokeApiKey(apiKeyId: string, tenantId: string): Promise<void> {
    await this.prisma.apiKey.updateMany({
      where: { id: apiKeyId, tenantId },
      data: { revokedAt: new Date() },
    });
  }
}

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

interface InterPodPayload {
  podId: string;
  instanceId?: string;
  action: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class InterPodJwtService {
  private readonly logger = new Logger(InterPodJwtService.name);
  private readonly privateKey: string;
  private readonly publicKey: string;

  constructor() {
    this.privateKey = process.env.INTER_POD_PRIVATE_KEY ?? '';
    this.publicKey = process.env.INTER_POD_PUBLIC_KEY ?? '';
  }

  generateToken(payload: Omit<InterPodPayload, 'iat' | 'exp'>): string {
    if (!this.privateKey) {
      this.logger.warn('INTER_POD_PRIVATE_KEY not configured, using HMAC fallback');
      return jwt.sign(payload, process.env.JWT_SECRET ?? 'dev-secret', {
        expiresIn: '5m',
        issuer: 'nexconnect-api',
        audience: 'nexconnect-worker',
      });
    }

    return jwt.sign(payload, this.privateKey, {
      algorithm: 'RS256',
      expiresIn: '5m',
      issuer: 'nexconnect-api',
      audience: 'nexconnect-worker',
    });
  }

  verifyToken(token: string): InterPodPayload {
    try {
      const key = this.publicKey || process.env.JWT_SECRET || 'dev-secret';
      const algorithms = this.publicKey ? ['RS256'] : ['HS256'];

      return jwt.verify(token, key, {
        algorithms: algorithms as jwt.Algorithm[],
        issuer: 'nexconnect-api',
        audience: 'nexconnect-worker',
      }) as InterPodPayload;
    } catch (error) {
      this.logger.error(
        { error: (error as Error).message },
        'inter-pod.jwt.verification.failed',
      );
      throw new UnauthorizedException('Invalid inter-pod token');
    }
  }
}

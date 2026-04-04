import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';

@Injectable()
export class IpAllowlistGuard implements CanActivate {
  private readonly logger = new Logger(IpAllowlistGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const tenant = (request as any).tenant;

    if (!tenant) {
      return true;
    }

    const settings = (tenant.settings as Record<string, unknown>) ?? {};
    const ipAllowlist = settings.ipAllowlist as string[] | undefined;

    if (!ipAllowlist || ipAllowlist.length === 0) {
      return true;
    }

    const clientIp = request.ip;

    const isAllowed = ipAllowlist.some((allowedIp) => {
      if (allowedIp.includes('/')) {
        return this.matchCidr(clientIp, allowedIp);
      }
      return clientIp === allowedIp;
    });

    if (!isAllowed) {
      this.logger.warn(
        { tenantId: tenant.id, clientIp },
        'IP not in allowlist, access denied',
      );
      throw new ForbiddenException('IP address not allowed');
    }

    return true;
  }

  private matchCidr(ip: string, cidr: string): boolean {
    const [subnet, prefixLengthStr] = cidr.split('/');
    const prefixLength = parseInt(prefixLengthStr, 10);

    if (isNaN(prefixLength) || prefixLength < 0 || prefixLength > 32) {
      return false;
    }

    const ipNum = this.ipToNumber(ip);
    const subnetNum = this.ipToNumber(subnet);

    if (ipNum === null || subnetNum === null) {
      return false;
    }

    const mask = prefixLength === 0 ? 0 : (~0 << (32 - prefixLength)) >>> 0;

    return (ipNum & mask) === (subnetNum & mask);
  }

  private ipToNumber(ip: string): number | null {
    const parts = ip.split('.');

    if (parts.length !== 4) {
      return null;
    }

    let result = 0;

    for (const part of parts) {
      const num = parseInt(part, 10);

      if (isNaN(num) || num < 0 || num > 255) {
        return null;
      }

      result = (result << 8) | num;
    }

    return result >>> 0;
  }
}

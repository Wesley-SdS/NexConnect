import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_SCOPES_KEY } from '../decorators/api-key-scopes.decorator';
import { IS_PUBLIC_KEY } from './api-key.guard';

@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredScopes = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredScopes || requiredScopes.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKeyScopes: string[] = request.apiKeyScopes ?? [];

    if (apiKeyScopes.includes('admin')) {
      return true;
    }

    const hasAllScopes = requiredScopes.every((scope) =>
      apiKeyScopes.includes(scope),
    );

    if (!hasAllScopes) {
      throw new ForbiddenException(
        `Insufficient scopes. Required: [${requiredScopes.join(', ')}]`,
      );
    }

    return true;
  }
}

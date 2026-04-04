import { SetMetadata } from '@nestjs/common';

export const REQUIRED_SCOPES_KEY = 'requiredScopes';

export const RequiredScopes = (...scopes: string[]) =>
  SetMetadata(REQUIRED_SCOPES_KEY, scopes);

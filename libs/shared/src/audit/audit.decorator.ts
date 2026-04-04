import { SetMetadata } from '@nestjs/common';

export const AUDITABLE_KEY = 'auditable';

export interface AuditableMetadata {
  action: string;
  resourceType: string;
}

/**
 * Decorator that marks a controller method for automatic audit logging.
 *
 * When combined with the AuditInterceptor (registered via APP_INTERCEPTOR),
 * the decorated method will automatically log an audit entry after
 * successful execution.
 *
 * @param action - The action being performed (e.g. 'create', 'update', 'delete')
 * @param resourceType - The type of resource (e.g. 'instance', 'webhook', 'tenant')
 */
export const Auditable = (action: string, resourceType: string) =>
  SetMetadata(AUDITABLE_KEY, { action, resourceType } as AuditableMetadata);

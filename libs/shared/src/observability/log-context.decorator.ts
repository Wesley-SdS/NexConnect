import { Logger } from '@nestjs/common';

/**
 * Structured log context extracted from method arguments.
 */
export interface LogContextData {
  resourceType: string;
  tenantId?: string;
  resourceId?: string;
  correlationId?: string;
  [key: string]: unknown;
}

/**
 * Method decorator that wraps a method to add structured logging context.
 *
 * Automatically extracts `tenantId` from the first argument and `resourceId`
 * from the second argument, then logs method entry/exit with duration and
 * structured context.
 *
 * @param resourceType - The type of resource being operated on (e.g. 'instance', 'message', 'broadcast')
 *
 * @example
 * ```ts
 * class InstancesService {
 *   @LogContext('instance')
 *   async connect(tenantId: string, instanceId: string) { ... }
 * }
 * ```
 */
export function LogContext(resourceType: string): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = String(propertyKey);
    const logger = new Logger(`${className}.${methodName}`);

    descriptor.value = async function (...args: any[]) {
      const context: LogContextData = {
        resourceType,
        tenantId: typeof args[0] === 'string' ? args[0] : undefined,
        resourceId: typeof args[1] === 'string' ? args[1] : undefined,
      };

      // Attempt to extract correlationId from an object argument (e.g. a DTO or request context)
      for (const arg of args) {
        if (arg && typeof arg === 'object' && 'correlationId' in arg) {
          context.correlationId = arg.correlationId;
          break;
        }
      }

      const startTime = Date.now();

      logger.debug({
        event: `${methodName}.start`,
        ...context,
      });

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;

        logger.log({
          event: `${methodName}.success`,
          durationMs: duration,
          ...context,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        logger.error({
          event: `${methodName}.error`,
          durationMs: duration,
          error: (error as Error).message,
          errorName: (error as Error).name,
          ...context,
        });

        throw error;
      }
    };

    // Preserve original method name for reflection
    Object.defineProperty(descriptor.value, 'name', {
      value: methodName,
      writable: false,
    });

    return descriptor;
  };
}

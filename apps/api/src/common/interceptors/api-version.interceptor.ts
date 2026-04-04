import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { FastifyReply, FastifyRequest } from 'fastify';

const SUPPORTED_VERSIONS = ['v1'] as const;
const DEFAULT_VERSION = 'v1';

/**
 * Custom metadata key to mark endpoints as deprecated.
 * Usage: @SetMetadata(DEPRECATED_KEY, { since: 'v1', sunset: '2026-12-01' })
 */
export const DEPRECATED_KEY = 'api:deprecated';

export interface DeprecationMeta {
  /** API version since which this endpoint is deprecated */
  since: string;
  /** ISO date when the endpoint will be removed */
  sunset: string;
  /** Optional replacement endpoint */
  replacement?: string;
}

/**
 * Interceptor that handles API versioning via the X-API-Version header.
 *
 * - Reads the requested version from the `X-API-Version` request header (defaults to 'v1').
 * - Echoes the resolved version back as a response header.
 * - Adds `X-Deprecation` and `Sunset` headers for endpoints marked with @SetMetadata(DEPRECATED_KEY, ...).
 */
@Injectable()
export class ApiVersionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApiVersionInterceptor.name);

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();

    const requestedVersion =
      (request.headers['x-api-version'] as string)?.toLowerCase() ||
      DEFAULT_VERSION;

    const resolvedVersion = SUPPORTED_VERSIONS.includes(
      requestedVersion as (typeof SUPPORTED_VERSIONS)[number],
    )
      ? requestedVersion
      : DEFAULT_VERSION;

    reply.header('X-API-Version', resolvedVersion);

    const deprecation = this.reflector.getAllAndOverride<
      DeprecationMeta | undefined
    >(DEPRECATED_KEY, [context.getHandler(), context.getClass()]);

    if (deprecation) {
      reply.header(
        'X-Deprecation',
        `Deprecated since ${deprecation.since}`,
      );
      reply.header('Sunset', deprecation.sunset);

      if (deprecation.replacement) {
        reply.header(
          'Link',
          `<${deprecation.replacement}>; rel="successor-version"`,
        );
      }

      this.logger.warn(
        {
          path: request.url,
          method: request.method,
          deprecatedSince: deprecation.since,
          sunset: deprecation.sunset,
        },
        'Deprecated endpoint accessed',
      );
    }

    return next.handle().pipe(
      tap({
        error: () => {
          // Ensure version header is present even on error responses
          reply.header('X-API-Version', resolvedVersion);
        },
      }),
    );
  }
}

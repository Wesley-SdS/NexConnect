import { Injectable } from '@nestjs/common';
import { HttpClient } from '@nexconnect/shared';

export interface MetaHttpClientConfig {
  accessToken: string;
  apiVersion?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

const CLIENT_CACHE = new WeakMap<object, HttpClient>();

@Injectable()
export class MetaHttpClientFactory {
  create(config: MetaHttpClientConfig, cacheKey?: object): HttpClient {
    if (cacheKey && CLIENT_CACHE.has(cacheKey)) {
      return CLIENT_CACHE.get(cacheKey)!;
    }
    const apiVersion = config.apiVersion ?? process.env.META_GRAPH_API_VERSION ?? 'v21.0';
    const base = `${(config.baseUrl ?? process.env.META_GRAPH_API_BASE_URL ?? 'https://graph.facebook.com').replace(/\/+$/, '')}/${apiVersion}`;

    const client = new HttpClient({
      name: `meta-graph:${apiVersion}`,
      baseUrl: base,
      defaultHeaders: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      defaultTimeoutMs: config.timeoutMs ?? Number(process.env.META_REQUEST_TIMEOUT_MS ?? 30_000),
      circuitBreaker: {
        failureThreshold: 10,
        resetTimeoutMs: 30_000,
      },
    });

    if (cacheKey) {
      CLIENT_CACHE.set(cacheKey, client);
    }
    return client;
  }
}

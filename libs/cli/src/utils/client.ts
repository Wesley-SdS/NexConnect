import { NexConnect } from '@nexconnect/sdk';
import { getApiKey, getBaseUrl } from './config';

let cachedClient: NexConnect | null = null;

export function getClient(): NexConnect {
  if (cachedClient) return cachedClient;

  cachedClient = new NexConnect({
    apiKey: getApiKey(),
    baseUrl: getBaseUrl(),
  });

  return cachedClient;
}

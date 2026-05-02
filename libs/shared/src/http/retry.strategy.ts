import { DEFAULT_RETRY_POLICY, RetryPolicy } from './http-client.types';

export function resolveRetryPolicy(policy?: Partial<RetryPolicy>): RetryPolicy {
  if (!policy) {
    return DEFAULT_RETRY_POLICY;
  }
  return {
    ...DEFAULT_RETRY_POLICY,
    ...policy,
    retryOnStatuses: policy.retryOnStatuses ?? DEFAULT_RETRY_POLICY.retryOnStatuses,
  };
}

export function computeBackoffMs(
  attempt: number,
  policy: RetryPolicy,
  retryAfterHeader?: string | null,
): number {
  if (retryAfterHeader) {
    const asNumber = Number(retryAfterHeader);
    if (Number.isFinite(asNumber)) {
      return Math.min(asNumber * 1000, policy.maxBackoffMs);
    }
    const asDate = Date.parse(retryAfterHeader);
    if (Number.isFinite(asDate)) {
      return Math.min(Math.max(0, asDate - Date.now()), policy.maxBackoffMs);
    }
  }

  const exponential = Math.min(
    policy.initialBackoffMs * Math.pow(policy.backoffMultiplier, attempt - 1),
    policy.maxBackoffMs,
  );

  if (!policy.jitter) {
    return exponential;
  }

  const randomFactor = 0.5 + Math.random();
  return Math.min(Math.round(exponential * randomFactor), policy.maxBackoffMs);
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('Aborted'));
      },
      { once: true },
    );
  });
}

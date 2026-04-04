export enum TenantPlan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export interface TenantPlanLimits {
  /** Maximum WhatsApp instances. -1 = unlimited */
  maxInstances: number;
  /** Maximum messages per day. -1 = unlimited */
  messagesPerDay: number;
  /** Maximum broadcasts per day. -1 = unlimited */
  broadcastsPerDay: number;
  /** Maximum API requests per minute. -1 = unlimited */
  apiRequestsPerMinute: number;
}

export const TENANT_PLAN_LIMITS: Record<TenantPlan, TenantPlanLimits> = {
  [TenantPlan.FREE]: {
    maxInstances: 2,
    messagesPerDay: 1_000,
    broadcastsPerDay: 1,
    apiRequestsPerMinute: 100,
  },
  [TenantPlan.STARTER]: {
    maxInstances: 10,
    messagesPerDay: 10_000,
    broadcastsPerDay: 10,
    apiRequestsPerMinute: 500,
  },
  [TenantPlan.PRO]: {
    maxInstances: 50,
    messagesPerDay: 100_000,
    broadcastsPerDay: 100,
    apiRequestsPerMinute: 2_000,
  },
  [TenantPlan.ENTERPRISE]: {
    maxInstances: -1,
    messagesPerDay: -1,
    broadcastsPerDay: -1,
    apiRequestsPerMinute: 10_000,
  },
};

/**
 * Returns the rate limits for a given tenant plan.
 * Defaults to FREE if the plan is unknown.
 */
export function getTenantLimits(plan: TenantPlan): TenantPlanLimits {
  return TENANT_PLAN_LIMITS[plan] ?? TENANT_PLAN_LIMITS[TenantPlan.FREE];
}

/**
 * Checks whether a limit value means "unlimited".
 */
export function isUnlimited(value: number): boolean {
  return value === -1;
}

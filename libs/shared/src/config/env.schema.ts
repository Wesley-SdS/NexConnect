import { z } from 'zod';

const booleanString = z
  .string()
  .transform((v) => v.toLowerCase() === 'true')
  .pipe(z.boolean());

const numericString = (fallback: number) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .pipe(z.number().int().nonnegative())
    .default(fallback);

export const metaEnvSchema = z.object({
  META_GRAPH_API_VERSION: z.string().default('v21.0'),
  META_GRAPH_API_BASE_URL: z.string().url().default('https://graph.facebook.com'),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  META_WEBHOOK_CALLBACK_PATH: z.string().default('/v1/webhooks/meta'),
  META_DEFAULT_ACCESS_TOKEN: z.string().optional(),
  META_REQUEST_TIMEOUT_MS: numericString(30_000),
});

export const twilioEnvSchema = z.object({
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_API_KEY_SID: z.string().optional(),
  TWILIO_API_KEY_SECRET: z.string().optional(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),
  TWILIO_VERIFY_SERVICE_SID: z.string().optional(),
  TWILIO_APPLICATION_SID: z.string().optional(),
  TWILIO_WEBHOOK_CALLBACK_PATH: z.string().default('/v1/webhooks/twilio'),
  TWILIO_STATUS_CALLBACK_URL: z.string().url().optional(),
  TWILIO_VALIDATE_SIGNATURE: booleanString.default('true' as unknown as boolean),
  TWILIO_REQUEST_TIMEOUT_MS: numericString(30_000),
});

export const appEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    ENCRYPTION_KEY: z.string().min(16),
    API_PORT: numericString(3100),
  })
  .merge(metaEnvSchema)
  .merge(twilioEnvSchema);

export type AppEnv = z.infer<typeof appEnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = appEnvSchema.safeParse(source);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${message}`);
  }
  return parsed.data;
}

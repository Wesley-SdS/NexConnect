-- NexConnect provider integration (Meta WhatsApp Cloud + Instagram + Messenger + Twilio)

-- ─── Enums ──────────────────────────────────────────────

CREATE TYPE "ProviderType" AS ENUM (
  'BAILEYS',
  'META_WHATSAPP_CLOUD',
  'META_INSTAGRAM',
  'META_MESSENGER',
  'TWILIO_SMS',
  'TWILIO_WHATSAPP',
  'TWILIO_VOICE',
  'TWILIO_VERIFY'
);

CREATE TYPE "ProviderCredentialStatus" AS ENUM (
  'ACTIVE',
  'REVOKED',
  'EXPIRED',
  'ERROR'
);

CREATE TYPE "TemplateCategory" AS ENUM (
  'AUTHENTICATION',
  'MARKETING',
  'UTILITY'
);

CREATE TYPE "TemplateStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'PAUSED',
  'DISABLED'
);

CREATE TYPE "InboundEventStatus" AS ENUM (
  'RECEIVED',
  'PROCESSED',
  'DISCARDED',
  'FAILED'
);

-- ─── ProviderCredential ─────────────────────────────────

CREATE TABLE "provider_credentials" (
  "id"                     UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"              UUID NOT NULL,
  "instance_id"            UUID,
  "provider"               "ProviderType" NOT NULL,
  "display_name"           TEXT NOT NULL,
  "credentials_encrypted"  BYTEA NOT NULL,
  "external_account_id"    TEXT,
  "external_phone_id"      TEXT,
  "phone_number"           TEXT,
  "webhook_verify_token"   TEXT,
  "webhook_callback_url"   TEXT,
  "status"                 "ProviderCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
  "last_used_at"           TIMESTAMP(3),
  "last_rotated_at"        TIMESTAMP(3),
  "expires_at"             TIMESTAMP(3),
  "metadata"               JSONB,
  "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_credentials_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "provider_credentials"
  ADD CONSTRAINT "provider_credentials_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;

ALTER TABLE "provider_credentials"
  ADD CONSTRAINT "provider_credentials_instance_id_fkey"
  FOREIGN KEY ("instance_id") REFERENCES "instances"("id") ON DELETE SET NULL;

CREATE INDEX "provider_credentials_tenant_id_provider_idx"
  ON "provider_credentials"("tenant_id", "provider");
CREATE INDEX "provider_credentials_external_account_id_provider_idx"
  ON "provider_credentials"("external_account_id", "provider");
CREATE INDEX "provider_credentials_external_phone_id_idx"
  ON "provider_credentials"("external_phone_id");

-- ─── MessageTemplate ────────────────────────────────────

CREATE TABLE "message_templates" (
  "id"                   UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"            UUID NOT NULL,
  "credential_id"        UUID NOT NULL,
  "external_template_id" TEXT,
  "name"                 TEXT NOT NULL,
  "language"             TEXT NOT NULL,
  "category"             "TemplateCategory" NOT NULL,
  "components"           JSONB NOT NULL,
  "status"               "TemplateStatus" NOT NULL DEFAULT 'PENDING',
  "rejection_reason"     TEXT,
  "quality_score"        TEXT,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "message_templates"
  ADD CONSTRAINT "message_templates_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;

ALTER TABLE "message_templates"
  ADD CONSTRAINT "message_templates_credential_id_fkey"
  FOREIGN KEY ("credential_id") REFERENCES "provider_credentials"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "message_templates_credential_id_name_language_key"
  ON "message_templates"("credential_id", "name", "language");
CREATE INDEX "message_templates_tenant_id_status_idx"
  ON "message_templates"("tenant_id", "status");

-- ─── ExternalMessageMapping ─────────────────────────────

CREATE TABLE "external_message_mappings" (
  "id"                   UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"            UUID NOT NULL,
  "instance_id"          UUID NOT NULL,
  "provider"             "ProviderType" NOT NULL,
  "external_message_id"  TEXT NOT NULL,
  "internal_message_id"  TEXT NOT NULL,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_message_mappings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "external_message_mappings"
  ADD CONSTRAINT "external_message_mappings_instance_id_fkey"
  FOREIGN KEY ("instance_id") REFERENCES "instances"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "external_message_mappings_provider_external_message_id_key"
  ON "external_message_mappings"("provider", "external_message_id");
CREATE INDEX "external_message_mappings_internal_message_id_idx"
  ON "external_message_mappings"("internal_message_id");
CREATE INDEX "external_message_mappings_tenant_id_provider_idx"
  ON "external_message_mappings"("tenant_id", "provider");

-- ─── InboundWebhookEvent ────────────────────────────────

CREATE TABLE "inbound_webhook_events" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"     UUID,
  "provider"      "ProviderType" NOT NULL,
  "event_type"    TEXT NOT NULL,
  "external_id"   TEXT,
  "headers"       JSONB NOT NULL,
  "raw_payload"   JSONB NOT NULL,
  "status"        "InboundEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "error"         TEXT,
  "received_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at"  TIMESTAMP(3),
  CONSTRAINT "inbound_webhook_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "inbound_webhook_events"
  ADD CONSTRAINT "inbound_webhook_events_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL;

CREATE INDEX "inbound_webhook_events_provider_received_at_idx"
  ON "inbound_webhook_events"("provider", "received_at" DESC);
CREATE INDEX "inbound_webhook_events_tenant_id_status_idx"
  ON "inbound_webhook_events"("tenant_id", "status");
CREATE INDEX "inbound_webhook_events_external_id_idx"
  ON "inbound_webhook_events"("external_id");

-- ─── Message: provider + external id columns ───────────

ALTER TABLE "messages"
  ADD COLUMN "provider"     "ProviderType" NOT NULL DEFAULT 'BAILEYS',
  ADD COLUMN "external_id"  TEXT,
  ADD COLUMN "from_address" TEXT,
  ADD COLUMN "to_address"   TEXT,
  ADD COLUMN "error_code"   TEXT,
  ADD COLUMN "error_reason" TEXT;

CREATE INDEX "messages_provider_external_id_idx"
  ON "messages"("provider", "external_id");

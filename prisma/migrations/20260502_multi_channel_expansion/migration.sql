-- NexConnect multi-channel expansion (Telegram + Discord + Slack + Twilio RCS)
-- + advanced message types (CARD, POLL_VOTE, DICE, STORY_REPLY, FLOW, SLASH_COMMAND)
-- + ConversationPricing tracking table.

-- ─── Enum updates ──────────────────────────────────────

ALTER TYPE "ProviderType" ADD VALUE IF NOT EXISTS 'TWILIO_RCS';
ALTER TYPE "ProviderType" ADD VALUE IF NOT EXISTS 'TELEGRAM';
ALTER TYPE "ProviderType" ADD VALUE IF NOT EXISTS 'DISCORD';
ALTER TYPE "ProviderType" ADD VALUE IF NOT EXISTS 'SLACK';

ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'CARD';
ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'POLL_VOTE';
ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'DICE';
ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'STORY_REPLY';
ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'FLOW';
ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'SLASH_COMMAND';

-- ─── ConversationPricing ───────────────────────────────

CREATE TABLE "conversation_pricing" (
  "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"           UUID NOT NULL,
  "instance_id"         UUID NOT NULL,
  "provider"            "ProviderType" NOT NULL,
  "conversation_id"     TEXT,
  "external_message_id" TEXT,
  "category"            TEXT,
  "pricing_model"       TEXT,
  "billable"            BOOLEAN NOT NULL DEFAULT TRUE,
  "amount"              DECIMAL(12, 6),
  "currency"            VARCHAR(8),
  "occurred_at"         TIMESTAMP(3) NOT NULL,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversation_pricing_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "conversation_pricing"
  ADD CONSTRAINT "conversation_pricing_instance_id_fkey"
  FOREIGN KEY ("instance_id") REFERENCES "instances"("id") ON DELETE CASCADE;

CREATE INDEX "conversation_pricing_tenant_id_provider_occurred_at_idx"
  ON "conversation_pricing"("tenant_id", "provider", "occurred_at" DESC);
CREATE INDEX "conversation_pricing_conversation_id_idx"
  ON "conversation_pricing"("conversation_id");

# ADR-010 — Provider abstraction for Meta and Twilio

## Status

Accepted — 2026-04-24

## Context

NexConnect started as a Baileys-only WhatsApp engine (see [ADR-001](ADR-001-baileys-websocket-engine.md)).
Customers now require first-class support for Meta's official WhatsApp Business Cloud API,
Instagram Messaging, Facebook Messenger, and Twilio (SMS, MMS, WhatsApp, Voice, Verify).

The existing domain model (`Instance`, `Message`, `Webhook`, pipelines, queues) assumes a single
transport and embeds Baileys-specific identifiers (`waMessageId` as a WhatsApp proto id). A bolt-on
integration per new channel would multiply coupling: each `MessagesService.send()` call would need
to branch on `connectionType` and orchestrate the specific SDK inline.

## Decision

Introduce a polymorphic **messaging provider** abstraction at the domain layer and two
concrete provider families (Meta, Twilio) layered on top.

### 1. Core contract (`libs/core/src/providers`)

- `ProviderType` — discriminator enum: `BAILEYS`, `META_WHATSAPP_CLOUD`, `META_INSTAGRAM`,
  `META_MESSENGER`, `TWILIO_SMS`, `TWILIO_WHATSAPP`, `TWILIO_VOICE`, `TWILIO_VERIFY`.
- `ProviderCapability` — feature flags a provider advertises (`SEND_TEMPLATE`,
  `UPLOAD_MEDIA`, `MARK_READ`, `TYPING_INDICATOR`, …).
- `IMessagingProvider` — the stable contract every provider implements:
  `send()`, optional `markAsRead()`, `setTypingIndicator()`, `uploadMedia()`, `downloadMedia()`.
- `OutboundMessage` — normalized discriminated union covering every message kind NexConnect
  exposes (text, image, video, audio, document, sticker, location, contacts, interactive buttons,
  interactive list, template, reaction). Providers translate this to their native payload.
- `InboundMessage` + `InboundStatusUpdate` — normalized inbound model that webhook handlers
  produce regardless of source.
- `ProviderError` hierarchy — `ProviderAuthenticationError`, `ProviderRateLimitError`,
  `ProviderValidationError`, `ProviderSignatureError`, `ProviderUnsupportedOperationError`.
- `ProviderCredentialData` — typed union of credential shapes per provider type.

### 2. Shared infrastructure (`libs/shared`)

- `HttpClient` — fetch-based, per-provider singleton with retry policy (exponential backoff + jitter,
  `Retry-After` header support), circuit breaker (extends existing `CircuitBreaker`), and
  Pino-wrapped structured logs.
- `MetaSignatureValidator` — HMAC-SHA256 of raw body using `X-Hub-Signature-256`, constant-time compare.
- `TwilioSignatureValidator` — HMAC-SHA1 of concatenated URL+sorted params (form) or URL with
  `bodySHA256` query param (JSON). Constant-time compare.
- `env.schema.ts` — zod schema covering every Meta/Twilio env var with runtime validation.

### 3. Persistence (`prisma/schema.prisma`)

- `ProviderCredential` — per-tenant, optionally per-instance, AES-256-GCM encrypted JSON blob.
  Public identifiers (`externalAccountId`, `externalPhoneId`, `phoneNumber`) live unencrypted so
  webhooks can resolve owners without decryption.
- `MessageTemplate` — mirrors Meta template catalog (plus synced status/rejection info).
- `ExternalMessageMapping` — bidirectional mapping between provider-native ids and NexConnect
  message ids, required for status-callback reconciliation.
- `InboundWebhookEvent` — raw inbound event log for audit/replay.
- `Message` — added `provider`, `externalId`, `fromAddress`, `toAddress`, `errorCode`, `errorReason`.

### 4. Provider modules

- `apps/api/src/modules/meta/` — Graph API (v21.0 by default). WhatsApp Cloud + Instagram DM +
  Messenger, all sharing `MetaHttpClientFactory`, `MetaErrorMapper`, and a unified webhook
  receiver (Meta sends `whatsapp_business_account`, `instagram`, and `page` objects through the
  same endpoint). Signature validation via `MetaSignatureGuard`.
- `apps/api/src/modules/twilio/` — Twilio SDK wrappers per channel. SMS + WhatsApp share a common
  `TwilioMessagingProvider` base (only the channel and capability set differ). Voice and Verify
  have their own services. Signature validation via `TwilioSignatureGuard` (supports form and JSON).
- `apps/api/src/modules/providers/` — `ProviderRegistry` (lookup by `ProviderType`),
  `ProviderRegistrar` (auto-registers concrete providers on `OnModuleInit`),
  `ProviderCredentialService` (implements `CredentialResolver`), `ProviderDispatcherService`
  (single entry point for "send this OutboundMessage for this instance"),
  `CredentialEncryptionService`, `ProvidersController` (REST CRUD for credentials).

### 5. Webhook architecture

- Raw request body preserved via a Fastify `addContentTypeParser` hook in `main.ts`. Required for
  signature validation (Meta hashes the raw bytes; Twilio JSON hashes the raw body).
- Each provider webhook is a dedicated controller under `/v1/webhooks/meta` and
  `/v1/webhooks/twilio/*`, both marked `@Public()` and guarded by a provider-specific
  `SignatureGuard`.

### 6. Testability

- 47 new unit tests covering: signature validators (both providers, happy/malformed/tampered
  paths), HTTP client (retry on 5xx, `Retry-After`, non-retryable codes, network failures),
  Meta WhatsApp mapper (text, media, interactive buttons/list, reaction, template, validation),
  Meta inbound mapper (text, media, interactive, delivered/failed statuses), Twilio mapper
  (SMS, WhatsApp prefixing, `messagingServiceSid`, media, unsupported types),
  Twilio inbound mapper (text, media, delivered/failed statuses).

## Consequences

### Positive

- Adding new providers is confined to a new module + registry entry. No changes to
  `MessagesService`, pipelines, or existing tables.
- Callers (`ProviderDispatcherService.dispatch()`) never see SDK primitives. Provider-specific
  retries and rate limits stay inside the provider.
- Credentials are encrypted at rest (AES-256-GCM via `ENCRYPTION_KEY`); rotation is a single
  PATCH call that updates `lastRotatedAt`.
- Status callbacks and inbound messages reconcile cleanly: the mapping table converts native ids
  back to internal ULIDs, so existing webhook dispatch infrastructure just works for all channels.

### Negative / Trade-offs

- `Message` now has both `waMessageId` (legacy Baileys unique index) and `externalId`
  (per-provider). Kept `waMessageId` populated from `externalId` on upsert to avoid breaking
  existing queries/indexes until a follow-up migration consolidates them.
- The original `ConnectionType.WABA` enum value remains for backwards compatibility, but the
  source of truth for "which provider owns this instance" is now `ProviderCredential.provider`.
- Baileys is not yet wrapped as an `IMessagingProvider` implementation — existing Baileys flow
  stays as-is and coexists. Follow-up ADR will unify if needed.

## References

- [Meta WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) — v21.0 is
  the default Graph API version.
- [Meta webhook signature](https://developers.facebook.com/docs/graph-api/webhooks/getting-started) —
  `X-Hub-Signature-256`.
- [Twilio Messages API](https://www.twilio.com/docs/messaging/api/message-resource).
- [Twilio webhook security](https://www.twilio.com/docs/usage/webhooks/webhooks-security) —
  `X-Twilio-Signature` form and JSON variants.

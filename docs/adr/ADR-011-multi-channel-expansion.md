# ADR-011 — Multi-channel expansion (Telegram, Discord, Slack, Twilio RCS)

## Status

Accepted — 2026-05-02

## Context

ADR-010 established a polymorphic provider abstraction (`IMessagingProvider`)
covering Meta (WhatsApp Cloud, Instagram, Messenger) and Twilio (SMS,
WhatsApp, Voice, Verify). Customers asked for parity on three additional
real-time channels (Telegram, Discord, Slack), advanced surfaces of the
existing channels (Meta Flows, WhatsApp Calling, conversation pricing,
Instagram story replies; Twilio Content API templates, Verify Push/TOTP,
RCS, Lookup), and operational features (read receipts via REST, reactions
via REST, webhook replay, Prometheus metrics, template binding validation).

## Decision

Extend the existing abstraction with the minimum surface needed and
implement each channel as a dedicated NestJS module that plugs into the
established provider registry / dispatcher / lifecycle infrastructure.

### Domain extensions (`libs/core/src/providers`)

- `ProviderType` → +`TELEGRAM`, +`DISCORD`, +`SLACK`, +`TWILIO_RCS`.
- `ProviderChannel` → matching channel constants + `RCS`.
- `ProviderCapability` → +`SEND_INTERACTIVE_CARD`, +`SEND_POLL`,
  +`SEND_DICE`, +`SEND_FLOW`, +`EDIT_MESSAGE`, +`DELETE_MESSAGE`,
  +`VERIFY_PUSH`, +`VERIFY_TOTP`, +`SLASH_COMMANDS`,
  +`EPHEMERAL_MESSAGE`, +`SCHEDULED_MESSAGE`.
- `MessageType` → +`CARD`, +`POLL_VOTE`, +`DICE`, +`STORY_REPLY`,
  +`FLOW`, +`SLASH_COMMAND`.
- `OutboundMessage` discriminated union → +`CardOutboundMessage`,
  +`PollOutboundMessage`, +`DiceOutboundMessage`,
  +`FlowOutboundMessage`, and `TemplateOutboundMessage` gained
  `contentSid` + `contentVariables` for Twilio Content templates.
- `IMessagingProvider` → +`editMessage?`, +`deleteMessage?`,
  +`addReaction?`, +`removeReaction?`, +`ping?`. All optional and
  gated by capability flags.
- `IProviderLifecycle` → companion contract for credential-lifecycle
  side effects (register webhook, register slash commands, subscribe
  WABA to app).

### Shared infrastructure (`libs/shared`)

- `Ed25519SignatureValidator` for Discord interactions (`tweetnacl`).
- `SlackSignatureValidator` for Slack `v0` HMAC-SHA256 with replay
  window (5-min default tolerance, configurable).
- `ProviderMetricsService` (global module): Prometheus counters and
  histograms — `nexconnect_provider_send_total`,
  `nexconnect_provider_send_duration_ms`,
  `nexconnect_webhook_received_total`,
  `nexconnect_webhook_signature_failures_total`,
  `nexconnect_provider_media_ingestion_total`.

### Persistence

- `ConversationPricing` table — captures per-conversation pricing
  records emitted by Meta status webhooks and Twilio status callbacks.
- `MessageType` enum gained the new variants. `ProviderType` enum
  gained the four new providers. Migration uses idempotent
  `ALTER TYPE … ADD VALUE IF NOT EXISTS`.

### New channel modules

#### Telegram (`apps/api/src/modules/telegram/`)
- `TelegramClient`: typed wrapper around `bot<token>/<method>` for
  send / edit / delete / reactions / typing / setWebhook / getMe /
  getFile + downloadFile.
- `TelegramMapper` → discriminated `{ method, params }` per Bot API
  endpoint (12 message variants including polls, dice, inline KB).
- `TelegramInboundMapper` covers messages, edited_message,
  channel_post, callback_query, poll_answer, my_chat_member.
- `TelegramSecretTokenGuard` validates the bot-controlled
  `X-Telegram-Bot-Api-Secret-Token` per credential id (URL-scoped).
- `TelegramWebhookController` at `/v1/webhooks/telegram/:credentialId`.
- `TelegramLifecycleService` calls `setWebhook` on credential
  create/rotate (using `TELEGRAM_PUBLIC_URL` or `APP_PUBLIC_URL`).

#### Discord (`apps/api/src/modules/discord/`)
- HTTP-only mode (no Gateway WebSocket): inbound via Interactions
  endpoint signed with **Ed25519**.
- `DiscordClient`: REST API v10 wrapper (`Bot <token>` auth):
  createMessage / edit / delete / reactions / typing / DM channel /
  slash command registration / interaction-callback URL.
- `DiscordMapper` builds embeds, action rows of buttons (max 5),
  `string_select` for lists (1–25 options), card embeds + LINK
  buttons, location as Maps URL string.
- `DiscordInboundMapper` classifies APPLICATION_COMMAND →
  `SLASH_COMMAND`, MESSAGE_COMPONENT button → `BUTTON_REPLY`, select
  → `LIST_REPLY`. Maps regular messages too.
- `DiscordEd25519Guard` validates `X-Signature-Ed25519` +
  `X-Signature-Timestamp`.
- `DiscordInteractionsController` returns `PONG` for type 1 and
  `DEFERRED` for command/component/modal so consumers can follow up
  via Discord's 15-min interaction-callback window.
- `DiscordLifecycleService` registers a default `/nexconnect`
  global slash command on credential create.

#### Slack (`apps/api/src/modules/slack/`)
- `SlackClient`: typed `chat.postMessage` / `update` / `delete` /
  `postEphemeral` / `reactions.add+remove` / `conversations.open` /
  `auth.test` / `views.open` / `files.uploadV2`. Maps both HTTP
  errors and Slack-side `{ ok: false, error }` to ProviderError via
  `SlackErrorMapper`.
- `SlackMapper` builds Block Kit (section + image + actions blocks):
  buttons (max 5 in a row), `static_select` for lists (1–100), card
  layouts with image accessory + button row + LINK.
- `SlackInboundMapper` for Events API, Interactivity payloads,
  slash commands. Skips bot's own `bot_message` echoes.
- `SlackSignatureGuard` (HMAC-SHA256 over `v0:<ts>:<body>` with the
  app signing secret, 5-min replay window).
- Three controllers under `/v1/webhooks/slack/:credentialId/*`:
  - `events` — handles `url_verification` challenge inline plus all
    event_callback payloads.
  - `interactivity` — block_actions, view_submission, shortcuts.
  - `commands` — slash commands with ephemeral acknowledgement.
- `SlackLifecycleService` smoke-tests credentials via `auth.test`.

#### Twilio extensions (`apps/api/src/modules/twilio/`)
- `TwilioContentService`: Twilio Content API templates (create /
  submit-for-approval / list / fetch / delete + name → ContentSid
  resolver).
- `TwilioVerifyPushService`: Verify v2 Push & TOTP factor flows
  (createFactor / verifyFactor / createChallenge / approveChallenge
  / deleteFactor) — separate service from the OTP-only
  `TwilioVerifyService`.
- `TwilioLookupService`: Lookup v2 (validate + caller name + carrier
  metadata + line type intelligence).
- `TwilioRcsProvider`: new `ProviderType.TWILIO_RCS` reusing the
  abstract `TwilioMessagingProvider` base. Recipients formatted as
  `rcs:+E164`.

### Meta advanced

- `WhatsAppCallingService`: Calling API
  (`POST {phone_number_id}/calls`) with connect / accept / reject /
  terminate.
- `WhatsAppCloudMapper.mapFlow`: builds interactive type `flow` with
  flow_message_version v3, flow_token, flow_id, flow_cta,
  flow_action, screen + data payload.
- `MetaCredentialLifecycle`: idempotent `subscribed_apps` call on
  credential create/rotate.
- `InstagramInboundMapper`: detects `story_mention` attachments and
  `reply_to.story` → `MessageType.STORY_REPLY`.
- `MetaWebhookService`: extracts `pricing` from status webhooks and
  records via `ConversationPricingService` for cost reporting.

### Cross-cutting / operational

- `ConversationPricingService`: persists pricing rows + provides a
  groupBy breakdown (provider × category × tenant × period).
- `ProviderLifecycleOrchestrator`: dispatches credential lifecycle
  to the right per-provider hook. Optional injection so deployments
  without a given provider module still bootstrap cleanly.
- `TemplateBindingValidator`: validates parameter count vs locally
  cached `MessageTemplate.components` so missing variables fail
  fast with a domain error instead of a generic Meta 400.
- `POST /v1/instances/:id/messages/:msgId/read`: invokes
  `IMessagingProvider.markAsRead` via the registry.
- `POST /v1/instances/:id/messages/:msgId/reactions`: invokes
  `IMessagingProvider.addReaction` with the supplied emoji.
- `POST /v1/webhooks/replay` (admin scope): re-delivers a stored
  `InboundWebhookEvent`. Skips signature validation (already done on
  first receipt) and routes to the right `*WebhookService`.

## Consequences

### Positive
- 9 channels supported end-to-end (Baileys, WhatsApp Cloud, Instagram,
  Messenger, Twilio SMS, Twilio WhatsApp, Twilio RCS, Telegram,
  Discord, Slack — plus Voice/Verify Twilio surfaces).
- Adding the 10th channel is purely additive: new module + entry in
  `ProviderRegistrar`. Zero changes to `MessagesService`,
  `ProviderDispatcher`, or persistence.
- Operational endpoints unify across channels — same REST surface
  works for read receipts and reactions on any provider that
  supports them.
- Webhook replay enables debugging and incident-mode reprocessing
  without external tooling.
- Prometheus counters per-provider give per-tenant cost / failure
  visibility for SLO reporting.

### Trade-offs
- The `OutboundMessage` discriminated union grew to 16 variants;
  long-term we should consider extracting per-channel types to keep
  the union focused, but the current shape works because each
  provider mapper only handles the variants it supports (others
  throw `ProviderUnsupportedOperationError`).
- Each new channel adds a fresh credential-shape entry to
  `ProviderCredentialData`. The shapes are intentionally explicit
  (no generic `Record<string, unknown>` blob) so the SDK can publish
  typed credentials and the encryption service can survive new
  fields without code changes.
- Webhook payloads vary widely in granularity — Telegram delivers
  full message snapshots, Slack delivers thin event envelopes,
  Discord delivers interactions only. The inbound mappers absorb
  this asymmetry; the dispatched normalized event is uniform.

## References

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Discord Developer Docs](https://discord.com/developers/docs)
- [Slack Web API](https://api.slack.com/web)
- [Slack Events API](https://api.slack.com/events-api)
- [Slack Block Kit](https://api.slack.com/block-kit)
- [Twilio Content API](https://www.twilio.com/docs/content)
- [Twilio Verify v2](https://www.twilio.com/docs/verify/api)
- [Twilio Lookup v2](https://www.twilio.com/docs/lookup)
- [WhatsApp Cloud Calling](https://developers.facebook.com/docs/whatsapp/cloud-api/calls)
- [WhatsApp Flows](https://developers.facebook.com/docs/whatsapp/flows)

# ADR-006: Speech-to-Text Processing in NexConnect

**Status:** Accepted
**Date:** 2026-03-30
**Author:** Wesley Lima — Orbitmind

## Context

When a WhatsApp user sends a voice message, downstream consumers (NexBot, third-party integrations) need the text transcription to process the intent. The question is whether STT should happen in NexConnect (the transport layer) or in NexBot (the AI layer).

NexBot is designed to receive normalized, ready-to-process payloads. If NexBot had to handle STT, every bot builder would need to implement audio-to-text conversion, duplicating effort and introducing inconsistent transcription quality.

## Decision

Perform **Speech-to-Text (STT) transcription inside NexConnect** as part of the inbound message pipeline, before the webhook payload is dispatched.

The transcription result is stored in the `transcription` column of `media_assets` and included in the webhook payload's `content` field. NexBot and other consumers receive a message with both the audio URL and the transcription text — no additional processing required.

## Alternatives Considered

| Option | Why Discarded |
|---|---|
| **STT in NexBot** | Every downstream consumer would need STT integration; duplicated cost and latency; NexBot should focus on intent, not media processing |
| **STT as a separate microservice** | Adds network hop and deployment complexity; STT is tightly coupled to the inbound message pipeline — separating it creates unnecessary coordination |
| **No STT (raw audio only)** | Forces all consumers to handle audio; most chatbot use cases require text; unacceptable developer experience |

## Consequences

**Positive:**
- NexBot receives a normalized payload — `content.text` is always available regardless of original message type
- Single transcription per audio — no duplicate API calls across multiple consumers
- Transcription is persisted in `media_assets.transcription` — available for audit and replay without re-processing
- Webhook payload is self-contained — third-party integrations work without STT infrastructure

**Negative:**
- Increases NexConnect's processing latency for audio messages (~1-3s depending on audio length and STT provider)
- NexConnect assumes responsibility for STT provider costs and availability
- Transcription quality is fixed at the NexConnect level — consumers cannot choose a different STT model per use case

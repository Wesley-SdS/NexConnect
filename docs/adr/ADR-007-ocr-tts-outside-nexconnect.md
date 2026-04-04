# ADR-007: OCR in Vektus, TTS in NexBot

**Status:** Accepted
**Date:** 2026-03-30
**Author:** Wesley Lima — Orbitmind

## Context

The Orbitmind ecosystem has three services with distinct responsibilities:
- **NexConnect** — WhatsApp transport layer (connect, send, receive, deliver webhooks)
- **NexBot** — AI/chatbot orchestration (intent processing, response generation, conversation flow)
- **Vektus** — Document intelligence platform (parsing, extraction, embeddings, RAG)

Two media processing capabilities need ownership: OCR (image/document to text) and TTS (text to audio). The question is where each belongs.

## Decision

- **OCR** is handled by **Vektus**. Image and document analysis is core to Vektus's document intelligence domain. NexConnect uploads the media to R2 and passes the URL to Vektus via the event pipeline. Vektus extracts text, generates embeddings, and stores results.

- **TTS** is handled by **NexBot**. Text-to-speech is a response generation concern — NexBot decides when and what to speak. NexBot generates the audio file and sends it back through NexConnect's outbound message API as an audio attachment.

NexConnect does **not** perform OCR or TTS. It remains a pure transport layer for these media types, only handling upload to R2 and URL resolution.

## Alternatives Considered

| Option | Why Discarded |
|---|---|
| **OCR in NexConnect** | NexConnect has no document understanding context; OCR without semantic extraction is low value; Vektus already has the ML pipeline |
| **TTS in NexConnect** | Response generation is a bot decision; NexConnect cannot know what text to synthesize or which voice to use |
| **All media processing in a shared service** | Violates bounded context; creates a monolithic media service with mixed concerns and scaling characteristics |
| **OCR in NexBot** | NexBot focuses on conversation, not document parsing; would duplicate Vektus's extraction capabilities |

## Consequences

**Positive:**
- Clean separation of concerns — each service owns a well-defined domain
- NexConnect stays lightweight — no ML model dependencies, no GPU requirements
- Vektus can optimize OCR with its existing document pipeline (layout analysis, table extraction, embedding generation)
- NexBot controls the full response lifecycle — voice selection, SSML, caching
- Each service scales independently based on its specific workload profile

**Negative:**
- Cross-service latency for OCR flow: NexConnect -> R2 -> Vektus -> NexBot (additional ~2-5s for document processing)
- Requires well-defined contracts between services for media URLs and callback payloads
- Debugging media processing issues requires tracing across three services (mitigated by OpenTelemetry distributed tracing)

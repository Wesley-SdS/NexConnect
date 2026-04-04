# ADR-001: Baileys as WhatsApp WebSocket Engine

**Status:** Accepted
**Date:** 2026-03-30
**Author:** Wesley Lima — Orbitmind

## Context

NexConnect needs a WhatsApp connectivity layer capable of maintaining hundreds of concurrent sessions per worker pod, with strict memory constraints (6GB per container). The three viable open-source options are Baileys, whatsapp-web.js, and WA-JS.

whatsapp-web.js depends on Puppeteer/Chromium to render the WhatsApp Web client inside a headless browser. Each instance consumes 400-800MB of RAM due to the browser process, limiting a 6GB pod to roughly 8-10 instances — far below our target of 30 per pod.

WA-JS operates similarly by injecting into WhatsApp Web via a browser context. It carries the same Chromium overhead and adds complexity through its injection-based approach, making session recovery less predictable.

## Decision

Use **Baileys** (`@whiskeysockets/baileys`) as the sole WhatsApp connectivity engine.

Baileys communicates directly with WhatsApp's multi-device WebSocket protocol without a browser intermediary. Each connection is a lightweight Node.js WebSocket client consuming approximately 50-150MB of RAM.

## Alternatives Considered

| Option | RAM per Instance | Browser Required | TypeScript Native | Why Discarded |
|---|---|---|---|---|
| **whatsapp-web.js** | 400-800MB | Yes (Puppeteer) | No (JS) | ~10x higher RAM; 8-10 instances per pod max |
| **WA-JS** | 400-800MB | Yes (injection) | No | Same browser overhead; less stable session recovery |
| **WhatsApp Cloud API** | Negligible | No | N/A | Requires Meta Business verification; per-message cost; no unofficial number support |

## Consequences

**Positive:**
- ~10x less RAM per instance (50-150MB vs 400-800MB), enabling 30 instances per pod within 6GB
- No browser dependencies — smaller container images (~200MB vs ~1.2GB with Chromium)
- TypeScript native — zero type shim overhead, full IntelliSense
- Direct WebSocket control allows custom reconnection, heartbeat, and session persistence logic

**Negative:**
- Baileys is community-maintained; WhatsApp protocol changes may break it without notice
- No official support or SLA from Meta — risk of account bans if rate limits are violated
- Auth state serialization must be implemented manually (handled via PostgreSQL persistence, see ADR-002)

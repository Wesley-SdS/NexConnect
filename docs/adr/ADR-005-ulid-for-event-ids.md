# ADR-005: ULID for Event and Message IDs

**Status:** Accepted
**Date:** 2026-03-30
**Author:** Wesley Lima — Orbitmind

## Context

Events and messages need globally unique identifiers that are safe to expose in APIs, sortable by creation time without a secondary index, and collision-resistant across distributed pods generating IDs concurrently.

The `events` and `messages` tables use string primary keys (not auto-generated UUIDs) because IDs are generated application-side before database insertion — enabling deduplication at the BullMQ layer and idempotent webhook delivery.

## Decision

Use **ULID** (Universally Unique Lexicographically Sortable Identifier) for all application-generated IDs (events, messages, broadcasts).

ULIDs are generated via the `UlidUtil` class in `libs/shared/src/utils/ulid.util.ts`. Database-generated IDs (instances, webhooks, tenants) continue using PostgreSQL's `gen_random_uuid()`.

## Alternatives Considered

| Option | Why Discarded |
|---|---|
| **UUID v4** | Not sortable; random distribution causes B-tree index fragmentation; 36 characters with hyphens |
| **UUID v7** | Sortable (timestamp prefix) but not yet standardized in all runtimes; longer than ULID (36 vs 26 chars) |
| **Auto-increment (BIGSERIAL)** | Exposes record count; not safe for public APIs; requires database roundtrip before insert; breaks distributed generation |
| **Snowflake ID** | Requires machine ID coordination; 64-bit integer overflow risk in JavaScript (`Number.MAX_SAFE_INTEGER`) |

## Consequences

**Positive:**
- Lexicographically sortable — `ORDER BY id` is equivalent to `ORDER BY created_at` without an additional index
- 26 characters, Crockford Base32 — shorter than UUID, URL-safe, case-insensitive
- 80 bits of randomness — collision probability < 1 in 10^24 per millisecond
- No database dependency for generation — IDs are created in-process before any I/O
- Safe for API exposure — does not leak sequence information

**Negative:**
- Timestamp component (48 bits) reveals approximate creation time — acceptable since `created_at` is already a public field
- Not a native PostgreSQL type — stored as `TEXT`; slightly less efficient than `UUID` for index comparisons
- Requires consistent ULID library across all services that generate IDs

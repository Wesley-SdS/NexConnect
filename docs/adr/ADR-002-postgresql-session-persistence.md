# ADR-002: PostgreSQL for Session Persistence

**Status:** Accepted
**Date:** 2026-03-30
**Author:** Wesley Lima — Orbitmind

## Context

Baileys generates authentication state (identity keys, pre-keys, sender keys) that must survive pod restarts, reschedules, and horizontal scaling. When a pod dies, a new pod must load the session and reconnect without forcing a QR code re-scan.

The auth state is serialized as a binary blob (encrypted via AES-256-GCM before storage) and associated with an instance record. We need a persistence layer that guarantees durability, supports queries by pod assignment, and integrates with our existing data model.

## Decision

Store encrypted auth state in **PostgreSQL** as a `Bytes` column (`auth_state_encrypted`) on the `instances` table.

Session load and save operations use the existing `PrismaService` with no additional infrastructure. Pod reassignment queries (`WHERE pod_id = ?`) leverage standard SQL indexes.

## Alternatives Considered

| Option | Why Discarded |
|---|---|
| **File on disk (PV)** | Not portable across pods; requires ReadWriteMany PVCs which are slow and complex on most cloud providers |
| **Redis** | Volatile by nature; even with AOF persistence, data loss risk on OOM eviction; not suitable for auth material |
| **S3/R2 object storage** | Higher latency (~100-300ms per read); eventually consistent; unnecessary complexity for structured key data |
| **SQLite per pod** | Same portability problem as files; no cross-pod query capability |

## Consequences

**Positive:**
- Strong durability guarantees (WAL, replication) — auth state survives any pod failure
- Single source of truth — no cache invalidation between storage layers
- Query flexibility — reassign instances to pods with `UPDATE instances SET pod_id = ? WHERE pod_id = ?`
- Encrypted at application level (AES-256-GCM) before write — database compromise does not expose session keys
- Transactional — auth state updates are atomic with instance status changes

**Negative:**
- Binary blob in PostgreSQL increases table size; vacuum/autovacuum must be tuned for TOAST tables
- Read latency slightly higher than Redis (~2-5ms vs ~0.5ms), but auth state is loaded only on connection init — not on every message
- Backup size increases proportionally with instance count

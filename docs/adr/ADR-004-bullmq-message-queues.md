# ADR-004: BullMQ for Message Queues

**Status:** Accepted
**Date:** 2026-03-30
**Author:** Wesley Lima — Orbitmind

## Context

NexConnect processes several asynchronous workloads: outbound message dispatch, webhook delivery with retries, broadcast fan-out, scheduled message execution, and media upload/transcription pipelines. These require reliable queues with priority support, rate limiting, delayed jobs, and retry with exponential backoff.

Redis is already a core dependency for instance status caching, pub/sub, and rate limiting. Adding a separate message broker would increase operational complexity.

## Decision

Use **BullMQ** as the queue system for all asynchronous workloads.

BullMQ runs on the existing Redis instance, providing:
- Priority queues (webhook delivery > broadcast messages > analytics)
- Per-queue and per-job rate limiting (respecting WhatsApp send windows)
- Delayed jobs (scheduled messages, retry backoff)
- Job deduplication via custom job IDs (ULID-based)
- Built-in stalled job detection and automatic retry

## Alternatives Considered

| Option | Why Discarded |
|---|---|
| **Amazon SQS** | No native priority queues; FIFO queues limited to 300 msg/s; adds AWS dependency for self-hosted deployments |
| **RabbitMQ** | Requires separate infrastructure (Erlang runtime); priority queues limited to 255 levels; operational overhead for clustering |
| **Apache Kafka** | Over-engineered for job queuing; designed for event streaming not task processing; no native delayed jobs or rate limiting |
| **Redis Streams (raw)** | No built-in retry, backoff, or priority; would require reimplementing most of BullMQ's logic |

## Consequences

**Positive:**
- Zero additional infrastructure — runs on the existing Redis instance
- Native TypeScript — type-safe job definitions, processors, and event handlers
- Rate limiting per queue prevents WhatsApp ban from message flooding
- Job lifecycle events enable real-time dashboard updates via SSE
- Bull Board available for debugging in development

**Negative:**
- Redis becomes a critical single point of failure for both cache and queues — requires Redis Sentinel or Cluster in production
- Large job backlogs increase Redis memory usage; `maxmemory-policy: allkeys-lru` could evict queue data if misconfigured
- BullMQ stores job data in Redis; jobs with large payloads (media metadata) should reference external storage, not inline data

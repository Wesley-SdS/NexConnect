# ADR-009: Atomic Rate Limiting with Lua Scripts

**Status:** Accepted
**Date:** 2026-04-04
**Author:** Wesley Lima — Orbitmind

## Context

NexConnect implements multi-level rate limiting (per API key, per instance, per recipient) using Redis counters with TTL-based sliding windows. The naive approach — `INCR` followed by `EXPIRE` in two separate commands — has a critical race condition: if the process crashes between `INCR` and `EXPIRE`, the counter key persists without a TTL, permanently blocking the rate-limited entity.

Additionally, the anti-spam stage (`AntiSpamStage`) tracks message volume per recipient with `INCRBY`, which has the same race condition with even higher impact — a stuck counter could permanently block message delivery to a phone number.

## Decision

Use **Redis Lua scripts** executed via `EVAL` to atomically combine increment and TTL operations in a single round-trip.

The `incrWithTtl` method in `RedisService`:
```lua
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
```

The `incrbyWithTtl` variant for batch increments:
```lua
local current = redis.call('INCRBY', KEYS[1], ARGV[1])
if current == tonumber(ARGV[1]) then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return current
```

Both scripts are atomic — Redis executes them without interleaving other commands. The TTL is set only on key creation (`current == 1` or `current == increment`), avoiding unnecessary `EXPIRE` calls on subsequent requests.

## Alternatives Considered

| Option | Why Discarded |
|---|---|
| **INCR + EXPIRE (two commands)** | Race condition: crash between commands leaves immortal keys that permanently block rate-limited entities |
| **SET NX EX + INCR** | Two round-trips; `SET NX` and `INCR` are not atomic together; edge case where `SET NX` fails but `INCR` succeeds |
| **Redis MULTI/EXEC transaction** | Atomic execution but no conditional logic — cannot conditionally set TTL only on first creation; always sends EXPIRE, wasting bandwidth |
| **Token bucket (separate library)** | Additional dependency; most libraries use Lua internally anyway; less control over exact behavior |
| **Fixed window with EXPIREAT** | Quantization boundary problem: a burst at window edge could allow 2x the limit across two adjacent windows |

## Consequences

**Positive:**
- Zero race conditions — increment and TTL are atomic, eliminating immortal key risk
- Single round-trip per rate limit check — lower latency than multi-command alternatives
- Conditional TTL — `EXPIRE` is only called on key creation, reducing Redis command load by ~50% on subsequent requests
- Same pattern reusable for any counter-with-expiry use case (anti-spam, broadcast throttling, etc.)

**Negative:**
- Lua scripts are opaque in Redis monitoring — `EVALSHA` appears as a single command, making debugging slightly harder
- Script must be present on all Redis nodes in a cluster — handled automatically by ioredis `EVAL` (falls back to script loading)
- Lua execution blocks Redis event loop — acceptable since these scripts are O(1) with negligible execution time

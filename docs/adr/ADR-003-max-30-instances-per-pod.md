# ADR-003: Maximum 30 Instances per Worker Pod

**Status:** Accepted
**Date:** 2026-03-30
**Author:** Wesley Lima — Orbitmind

## Context

Worker pods run Baileys WebSocket connections. Each connection maintains an in-memory protocol state, message buffers, and crypto contexts. Empirical testing shows each active instance consumes 50-150MB of RAM depending on message volume and group count.

Kubernetes containers have a hard memory limit to prevent noisy-neighbor effects. We set `resources.limits.memory: 6Gi` per worker pod. We need to define the maximum number of instances per pod that fits within this budget while leaving headroom for the Node.js runtime, BullMQ workers, and GC spikes.

## Decision

Cap at **30 instances per worker pod**, enforced by the constant `MAX_INSTANCES_PER_POD = 30` in `libs/shared/src/constants/index.ts`.

Memory budget breakdown:
- 30 instances x 100MB average = **3,000MB**
- Node.js runtime + V8 heap overhead = **~500MB**
- BullMQ workers + Redis connections = **~300MB**
- GC headroom + spike buffer = **~700MB**
- **Total: ~4,500MB** within the 6,144MB (6Gi) limit

The HPA scales worker pods based on the `active_instances` metric with a target average of 25 (83% utilization), triggering scale-up before reaching the cap.

## Alternatives Considered

| Cap | Why Discarded |
|---|---|
| **50 instances/pod** | 50 x 100MB = 5GB base; no headroom for GC or spikes; OOMKill risk |
| **10 instances/pod** | Safe but wasteful; 3x more pods needed; higher infrastructure cost |
| **Dynamic (auto-detect)** | Complex to implement reliably; GC pauses make real-time memory measurement unreliable for admission control |

## Consequences

**Positive:**
- Predictable resource usage per pod — capacity planning is straightforward
- ~33% memory headroom prevents OOMKill under load spikes
- HPA threshold at 25 ensures new pods are ready before existing ones saturate
- Simple admission control — scheduler rejects assignment when pod count >= 30

**Negative:**
- Fixed cap may underutilize pods with low-traffic instances (e.g., 30 idle instances use ~1.5GB of a 6GB pod)
- Requires pod count to scale linearly with instance count — 3,000 instances need ~100 pods minimum
- Cap must be revisited if Baileys memory profile changes significantly in future versions

# ADR-008: Service Responsibility Refactoring

**Status:** Accepted
**Date:** 2026-04-04
**Author:** Wesley Lima — Orbitmind

## Context

`InstancesService` had grown to 15+ methods spanning CRUD operations, lifecycle management (connect, disconnect, restart), metrics computation (health score, message volume), and webhook management. This violated the Single Responsibility Principle, making the service difficult to test, reason about, and extend.

Changes to lifecycle logic required understanding the entire 500+ line service. Test setup was complex because mocking required satisfying dependencies for unrelated functionality. The dependency graph was wide — a single service importing Prisma, Redis, BullMQ, and multiple other services.

## Decision

Split `InstancesService` into focused, single-responsibility services:

- **InstancesService**: CRUD operations and QR code generation only
- **InstanceLifecycleService**: Power on/off, restart, profile updates, pairing code management
- **InstanceMetricsService**: Health score calculation, message volume metrics, number health computation
- **Webhook operations**: Delegated to the existing `WebhooksService`

Each service owns a clearly defined subset of the domain. Cross-service communication happens via direct injection (same module) or module imports.

## Alternatives Considered

| Option | Why Discarded |
|---|---|
| **Keep monolithic service** | Continued growth would make testing and onboarding progressively harder |
| **Event-driven decomposition** | Over-engineered for in-process communication; adds latency and debugging complexity |
| **Facade pattern** | Preserves the fat interface; doesn't solve the root coupling problem |

## Consequences

**Positive:**
- Each service has 3-5 methods — easy to understand and test in isolation
- Dependency graph is narrower per service — fewer mocks in unit tests
- New developers can work on lifecycle logic without understanding metrics computation
- Enables independent scaling if services are later extracted to separate microservices

**Negative:**
- Potential for circular dependencies between lifecycle and metrics services — resolved with `forwardRef` where necessary
- More files to navigate — mitigated by consistent naming convention (`instance-*.service.ts`)
- Existing consumers of `InstancesService` needed updates to inject the correct sub-service

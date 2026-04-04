<p align="center">
  <img src="https://img.shields.io/badge/Node.js-22_LTS-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Prisma-6-2D3748?style=for-the-badge&logo=prisma&logoColor=white" />
  <img src="https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white" />
  <img src="https://img.shields.io/badge/License-UNLICENSED-lightgrey?style=for-the-badge" />
</p>

<h1 align="center">NexConnect</h1>

<p align="center">
  <strong>Enterprise WhatsApp Engine</strong><br />
  Pure transport layer for the NexBot ecosystem — no AI, no LLM, just fast and reliable WhatsApp delivery.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#api-reference">API Reference</a> &bull;
  <a href="#security">Security</a> &bull;
  <a href="#observability">Observability</a> &bull;
  <a href="#testing">Testing</a> &bull;
  <a href="#deployment">Deployment</a>
</p>

---

## Overview

NexConnect is a **multi-tenant WhatsApp microservice** that handles the entire communication layer between WhatsApp and the NexBot platform. It receives messages, normalizes them into a standard payload, and delivers them via webhooks — then routes responses back through WhatsApp.

### What NexConnect does

- Manages WhatsApp connections via Baileys WebSocket engine
- Processes messages through a 7-stage inbound pipeline
- Validates and delivers outbound messages through a 4-stage pipeline
- Downloads media, uploads to Cloudflare R2, transcribes audio (STT)
- Dispatches events via HMAC-signed webhooks with automatic retry
- Tracks number health scores and applies intelligent throttling
- Supports broadcasts with A/B testing and multi-instance load balancing

### What NexConnect does NOT do

| Capability | Owner |
|---|---|
| LLM inference & AI agents | NexBot |
| OCR / image understanding | Vektus |
| TTS (audio generation) | NexBot |
| RAG / Knowledge Base | Vektus |

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime** | Node.js 22 LTS + TypeScript 5.7 | Modern async runtime with strict typing |
| **Framework** | NestJS 11 + Fastify 5 | Enterprise DI framework with high-performance HTTP |
| **WhatsApp** | @WhiskeySockets/Baileys | WebSocket-based WhatsApp Web protocol |
| **Database** | PostgreSQL 16 + Prisma 6 | Multi-tenant data with Row-Level Security |
| **Cache** | Redis 7 + ioredis | Rate limiting, caching, pub/sub |
| **Queue** | BullMQ 5 | Distributed job processing with retry |
| **Storage** | Cloudflare R2 (S3-compatible) | Media file storage |
| **STT** | OpenAI Whisper / AssemblyAI / Azure | Audio transcription (pluggable) |
| **Observability** | OpenTelemetry + Prometheus + Pino | Distributed tracing, metrics, structured logs |
| **Testing** | Vitest + Supertest + Testcontainers + Pact | Unit, integration, E2E, contract tests |
| **Monorepo** | Turborepo + pnpm workspaces | Efficient multi-package builds |

---

## Quick Start

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | >= 22.0.0 |
| pnpm | >= 9.0.0 |
| Docker | Latest |

### Setup

```bash
# Clone and install
git clone <repo-url> nexconnect && cd nexconnect
pnpm install

# Configure environment
cp .env.example .env

# Start infrastructure
docker compose up -d postgres redis

# Setup database
pnpm db:generate
pnpm db:migrate

# Start development
pnpm dev:api      # API Gateway on port 3100
pnpm dev:worker   # Worker service
```

### One-command setup

```bash
./scripts/setup.sh
```

### Full Docker Compose

```bash
docker compose up -d   # Starts PostgreSQL, Redis, API, and Worker
```

### Useful commands

```bash
pnpm build            # Build all packages
pnpm lint             # Run ESLint
pnpm format           # Run Prettier
pnpm test             # Run unit tests
pnpm test:cov         # Tests with coverage report
pnpm test:e2e         # End-to-end tests
pnpm db:studio        # Open Prisma Studio GUI
pnpm db:seed          # Seed development data
```

---

## Architecture

### Monorepo Structure

```
nexconnect/
├── apps/
│   ├── api/                  # REST API Gateway (NestJS + Fastify)
│   └── worker/               # WhatsApp Worker (Baileys + BullMQ)
│
├── libs/
│   ├── core/                 # Shared DTOs, enums, interfaces
│   ├── database/             # Prisma ORM + multi-tenant context
│   ├── redis/                # Redis client with atomic Lua operations
│   ├── shared/               # Auth, crypto, observability, resilience
│   ├── sdk/                  # TypeScript SDK for API consumers
│   ├── cli/                  # CLI tool (nexconnect command)
│   └── testing/              # Testcontainers setup utilities
│
├── prisma/                   # Schema, migrations, RLS policies
├── infra/k8s/                # Kubernetes manifests (Kustomize)
├── docs/adr/                 # Architecture Decision Records
└── scripts/                  # Automation scripts
```

### System Layers

```
┌─────────────────────────────────────────────────────┐
│                    API Gateway                       │
│  Guards → Interceptors → Controllers → Services      │
├─────────────────────────────────────────────────────┤
│                  Service Layer                        │
│  InstancesService  │  LifecycleService  │  Metrics   │
│  MessagesService   │  BroadcastsService │  Webhooks  │
├─────────────────────────────────────────────────────┤
│                Job Queue (BullMQ)                     │
│  outbound-messages │ broadcast │ webhook-dispatch     │
│  instance-lifecycle │ scheduled │ verification        │
├─────────────────────────────────────────────────────┤
│                  Worker Pods                          │
│  Connection Pool → Inbound Pipeline → Forward         │
├─────────────────────────────────────────────────────┤
│              Infrastructure                           │
│  PostgreSQL (RLS) │ Redis │ Cloudflare R2            │
└─────────────────────────────────────────────────────┘
```

### Inbound Message Pipeline (Worker)

```
WhatsApp Event (Baileys WebSocket)
  │
  ├─ 1. Deduplication ── Redis KV with 1h TTL
  ├─ 2. Classification ── Identifies 15+ message types
  ├─ 3. Buffer ────────── Sliding window (3s default, adaptive)
  ├─ 4. Media Processing ─ Download → R2 upload → STT for audio
  ├─ 5. Enrichment ────── Profile name, tenant context, phone normalization
  ├─ 6. Presence ──────── Sends "typing..." indicator to sender
  └─ 7. Forward ───────── POST to webhooks with HMAC-SHA256 signature
```

### Outbound Message Pipeline (API)

```
API Request (POST /v1/instances/:id/messages)
  │
  ├─ 1. Validation ────────── Required fields check
  ├─ 2. Phone Verification ── E.164 normalization + validation
  ├─ 3. Anti-Spam ─────────── 30 msgs/min per recipient (atomic Redis)
  ├─ 4. Media Preparation ─── URL validation + 50MB/min upload limit
  └─ ✓ Queued to BullMQ → Worker delivers via Baileys
```

---

## API Reference

> Full interactive documentation available at **`/v1/api/docs`** (Swagger UI)

### Authentication

All requests require a Bearer token:

```
Authorization: Bearer nc_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

API keys support three scope levels:

| Scope | Access |
|---|---|
| `read` | Read instances, messages, groups, metrics |
| `send` | Send messages, reactions, manage presence |
| `admin` | Full access — create/delete instances, manage webhooks, API keys |

### Rate Limiting

Rate limits are enforced at three levels and scale with your tenant plan:

| Level | FREE | STARTER | PRO | ENTERPRISE |
|---|---|---|---|---|
| API requests/min | 100 | 500 | 2,000 | 10,000 |
| Instance requests/min | 100 | 100 | 100 | 100 |
| Per-recipient/min | 10 | 10 | 10 | 10 |

Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Tenant Plans

| Feature | FREE | STARTER | PRO | ENTERPRISE |
|---|---|---|---|---|
| Max instances | 2 | 10 | 50 | Unlimited |
| Messages/day | 1,000 | 10,000 | 100,000 | Unlimited |
| Broadcasts/day | 1 | 10 | 100 | Unlimited |

### Core Endpoints

#### Instances

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/instances` | Create a new WhatsApp instance |
| `GET` | `/v1/instances` | List all instances |
| `GET` | `/v1/instances/:id` | Get instance details |
| `PATCH` | `/v1/instances/:id` | Update instance settings |
| `DELETE` | `/v1/instances/:id` | Delete instance and all data |
| `GET` | `/v1/instances/:id/qrcode` | Get QR code for authentication |
| `POST` | `/v1/instances/:id/pairing-code` | Request pairing code |
| `POST` | `/v1/instances/:id/power-on` | Start WhatsApp connection |
| `POST` | `/v1/instances/:id/power-off` | Disconnect session |
| `POST` | `/v1/instances/:id/restart` | Restart connection |
| `PATCH` | `/v1/instances/:id/profile` | Update WhatsApp profile |
| `GET` | `/v1/instances/:id/health` | Instance health and connectivity |
| `GET` | `/v1/instances/:id/metrics` | Message volume and performance metrics |

#### Messages

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/instances/:id/messages` | Send a message (text, image, video, audio, document, location, vcard) |
| `GET` | `/v1/instances/:id/messages` | List messages with pagination and filters |
| `GET` | `/v1/instances/:id/messages/:msgId` | Get message details |
| `POST` | `/v1/instances/:id/messages/:msgId/react` | React to a message |

#### Webhooks

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/instances/:id/webhooks` | Register webhook endpoint |
| `PATCH` | `/v1/instances/:id/webhooks/:wid` | Update webhook configuration |
| `DELETE` | `/v1/instances/:id/webhooks/:wid` | Remove webhook |
| `POST` | `/v1/instances/:id/webhooks/:wid/test` | Send test payload |
| `POST` | `/v1/events/replay` | Replay historical events |

#### Groups

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/instances/:id/groups` | Create a WhatsApp group |
| `GET` | `/v1/instances/:id/groups` | List all groups |
| `GET` | `/v1/instances/:id/groups/:gid` | Group details |
| `PATCH` | `/v1/instances/:id/groups/:gid` | Update group info |
| `DELETE` | `/v1/instances/:id/groups/:gid` | Leave group |
| `POST` | `/v1/instances/:id/groups/:gid/participants` | Add participants |
| `DELETE` | `/v1/instances/:id/groups/:gid/participants` | Remove participants |

#### Broadcasts

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/broadcasts` | Create broadcast campaign |
| `GET` | `/v1/broadcasts` | List campaigns with pagination |
| `GET` | `/v1/broadcasts/:id` | Campaign details and progress |
| `PATCH` | `/v1/broadcasts/:id` | Pause / resume campaign |

Broadcast features:
- **Multi-instance load balancing** — round-robin, health-based, or random strategy
- **A/B testing** — weighted variants with automatic distribution
- **Configurable delay** — between messages to avoid rate limits

#### Scheduling

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/scheduled-messages` | Schedule a message for future delivery |
| `GET` | `/v1/scheduled-messages` | List scheduled messages |
| `DELETE` | `/v1/scheduled-messages/:id` | Cancel scheduled message |
| `POST` | `/v1/cron-jobs` | Create recurring message (cron expression) |
| `GET` | `/v1/cron-jobs` | List cron jobs |
| `DELETE` | `/v1/cron-jobs/:id` | Deactivate cron job |

#### Health & Metrics

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/v1/health` | Service health (database + Redis) |
| `GET` | `/v1/health/live` | Liveness probe (K8s) |
| `GET` | `/v1/health/ready` | Readiness probe (K8s) |
| `GET` | `/v1/metrics` | Prometheus metrics |

---

## Webhooks

### Event Delivery

All webhook payloads include cryptographic signatures for verification:

```
X-NexConnect-Signature: sha256=<hmac_hex>
X-NexConnect-Event: message.received
X-NexConnect-Delivery-Id: <ulid>
X-NexConnect-Timestamp: <unix_timestamp>
```

### Verification Example

```typescript
import crypto from 'crypto';

function verifyWebhook(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return `sha256=${expected}` === signature;
}
```

### Event Types (19)

| Category | Events |
|---|---|
| **Instance** | `instance.connected`, `instance.disconnected`, `instance.qrcode`, `instance.mentioned`, `instance.health_warning` |
| **Message** | `message.received`, `message.sent`, `message.delivered`, `message.read`, `message.deleted`, `message.reaction`, `message.pinned`, `message.unpinned` |
| **Group** | `group.created`, `group.updated`, `group.participants_added`, `group.participants_removed`, `group.participants_promoted`, `group.participants_demoted` |

### Retry Policy

Exponential backoff with configurable base (default: 2.5x):

| Attempt | Delay | Cumulative |
|---|---|---|
| 1st | ~2.5s | 2.5s |
| 2nd | ~6.3s | 8.8s |
| 3rd | ~15.6s | 24.4s |
| 4th | ~39s | 63.4s |
| 5th | ~97s | 160.4s |

After all attempts fail, events move to **dead letter** status. Use the replay endpoint to re-deliver.

---

## Security

### Multi-Layer Protection

```
Request → IP Allowlist → API Key Auth → Scope Check → Rate Limit → Tenant Isolation
```

| Layer | Implementation |
|---|---|
| **Authentication** | API keys with bcrypt hash + prefix-based O(1) lookup + Redis cache |
| **Authorization** | Scope-based access control (`read`, `send`, `admin`) |
| **Tenant Isolation** | PostgreSQL Row-Level Security + application-level filtering |
| **Rate Limiting** | Atomic Lua scripts in Redis (no race conditions) |
| **IP Allowlist** | CIDR notation support per tenant |
| **Webhook Secrets** | AES-256-GCM encrypted at rest |
| **Auth State** | Baileys session data encrypted with AES-256-GCM |
| **PII Redaction** | Automatic LGPD-compliant redaction in logs (CPF, CNPJ, phone, email, credit cards) |
| **Body Size Limits** | 10MB default, 50MB for media upload routes |
| **Audit Trail** | Immutable audit logs per tenant |

### Number Health Protection

Health scores are calculated on a 0-100 scale with weighted factors:

| Factor | Weight | Description |
|---|---|---|
| Response rate | 30% | Inbound/outbound message ratio |
| Read rate | 20% | Percentage of messages read |
| Bounce rate | 20% | Failed delivery percentage |
| Instance age | 15% | Account maturity (normalized at 90 days) |
| Volume ratio | 15% | Daily volume vs. ideal threshold |

**Automatic throttling actions:**

| Score | Grade | Action | Delay Multiplier |
|---|---|---|---|
| 81-100 | A | Normal operation | 1.0x |
| 60-80 | B-C | Light throttle | 1.2x |
| 40-59 | D | Heavy throttle | 2.0x |
| 0-39 | F | Pause proactive messaging | Paused |

### Warm-up Schedule

New instances follow an automatic warm-up curve:

| Days | Daily Limit | Phase |
|---|---|---|
| 1-3 | 10 messages | Seed |
| 4-7 | 50 messages | Grow |
| 8-14 | 200 messages | Establish |
| 15-30 | 1,000 messages | Scale |
| 30+ | Plan limit | Full |

---

## Observability

### Logging

- **Engine:** Pino (structured JSON)
- **Correlation:** Every request gets a ULID correlation ID via `X-Correlation-ID` header, propagated through `AsyncLocalStorage`
- **PII Redaction:** Automatic LGPD compliance — CPF, CNPJ, phone, email, and credit card numbers are redacted before logging
- **Context Propagation:** `RequestLogger` service with automatic tenantId/instanceId injection
- **Method Tracing:** `@LogContext()` decorator for automatic start/success/error logging with duration

### Distributed Tracing

- **Protocol:** OpenTelemetry (OTLP exporter)
- **Spans:** HTTP requests, BullMQ jobs, Prisma queries
- **Propagation:** Trace context flows from API → Queue → Worker
- **Configuration:** `OTEL_EXPORTER_OTLP_ENDPOINT` environment variable

### Metrics (Prometheus)

- `http_requests_total` — Counter by method, path, status
- `http_request_duration_seconds` — Histogram by method, path
- Custom business metrics per instance

### Health Probes

| Endpoint | Purpose | K8s Probe |
|---|---|---|
| `GET /v1/health` | Full health check (DB + Redis) | — |
| `GET /v1/health/live` | Process alive | Liveness |
| `GET /v1/health/ready` | Dependencies reachable | Readiness |

---

## Resilience

### Circuit Breaker

Built-in circuit breaker for external calls with three states:

| State | Behavior |
|---|---|
| **CLOSED** | Normal operation, counts failures |
| **OPEN** | Rejects immediately, waits for reset timeout (30s) |
| **HALF_OPEN** | Allows limited probe requests to test recovery |

Configurable: failure threshold, reset timeout, half-open max attempts.

### Graceful Shutdown

- Stops accepting new requests on SIGTERM/SIGINT
- Drains in-flight requests (30s timeout)
- Closes database and Redis connections cleanly
- Compatible with Kubernetes rolling updates

### Data Retention & LGPD Compliance

| Service | Capability |
|---|---|
| `DataRetentionService` | Purge expired messages, deliveries, and audit logs |
| `DataExportService` | Full tenant data export (LGPD Art. 18, V) |
| `eraseTenantPii()` | Right to erasure — hard delete all PII (LGPD Art. 18, VI) |

---

## Testing

### Test Infrastructure

| Tool | Purpose |
|---|---|
| **Vitest** | Unit and integration tests |
| **Supertest** | HTTP endpoint testing |
| **Testcontainers** | Docker-based PostgreSQL + Redis for integration tests |
| **Pact** | Consumer-driven contract testing |

### Running Tests

```bash
pnpm test             # Unit tests
pnpm test:cov         # With coverage report (HTML + JSON)
pnpm test:e2e         # End-to-end tests (requires Docker)
```

### Coverage Thresholds

| Metric | Threshold |
|---|---|
| Lines | 80% |
| Functions | 80% |
| Branches | 75% |
| Statements | 80% |

### Test Coverage

- **44 test files** covering guards, interceptors, filters, pipes, services, pipeline stages, utilities, SDK, and contract tests
- **100%** coverage on: guards, filters, pipes, outbound pipeline stages
- Integration tests with real PostgreSQL and Redis containers
- Contract tests validating webhook payload structure

---

## Deployment

### Kubernetes

NexConnect ships with production-ready Kustomize manifests in `infra/k8s/`:

```bash
kubectl apply -k infra/k8s/
```

**Namespace:** `nexconnect`

#### API Deployment
- 2 replicas with rolling updates
- Resources: 250m-1 CPU, 512Mi-1Gi memory
- Health probes: liveness, readiness, startup

#### Worker Deployment
- HPA: 2-50 replicas
- Scale metric: `active_instances` (target: 25 per pod)
- Memory target: 75% utilization
- Scale-up: 5 pods/60s, scale-down: 2 pods/120s

### Docker

Multi-stage Dockerfiles for minimal production images:

```bash
# Build images
docker build -t nexconnect-api -f apps/api/Dockerfile .
docker build -t nexconnect-worker -f apps/worker/Dockerfile .
```

### CI/CD (GitHub Actions)

Pipeline: **Lint → Test → Build → Docker Build**

- PostgreSQL 16 + Redis 7 service containers for tests
- Prisma client generation and migrations
- Coverage artifact upload
- Docker images built on main branch pushes

---

## Environment Variables

<details>
<summary>Click to expand full configuration reference</summary>

```bash
# ─── Database ────────────────────────────────────────────
DATABASE_URL="postgresql://user:pass@localhost:5432/nexconnect"

# ─── Redis ───────────────────────────────────────────────
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""

# ─── API ─────────────────────────────────────────────────
API_PORT=3100
API_HOST="0.0.0.0"
API_PREFIX="v1"
API_CORS_ORIGINS="http://localhost:3000"

# ─── Worker ──────────────────────────────────────────────
WORKER_MAX_INSTANCES_PER_POD=30
WORKER_POD_ID="pod-1"

# ─── Auth ────────────────────────────────────────────────
API_KEY_HASH_ROUNDS=12
JWT_SECRET="change-me-in-production"
JWT_EXPIRES_IN="1h"

# ─── Inter-Pod Communication (RS256) ────────────────────
INTER_POD_PRIVATE_KEY=""
INTER_POD_PUBLIC_KEY=""

# ─── Cloudflare R2 (S3-compatible) ──────────────────────
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME="nexconnect-media"
R2_PUBLIC_URL=""

# ─── Speech-to-Text ────────────────────────────────────
STT_PROVIDER="whisper"          # whisper | assemblyai | azure
OPENAI_API_KEY=""
ASSEMBLYAI_API_KEY=""
AZURE_SPEECH_KEY=""
AZURE_SPEECH_REGION=""

# ─── Webhook Delivery ──────────────────────────────────
WEBHOOK_RETRY_MAX_ATTEMPTS=5
WEBHOOK_RETRY_BACKOFF_BASE=2.5

# ─── Encryption ────────────────────────────────────────
ENCRYPTION_KEY="your-32-byte-hex-key-here"

# ─── Observability ─────────────────────────────────────
OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
LOG_LEVEL="info"                # debug | info | warn | error

# ─── NexBot Integration ───────────────────────────────
NEXBOT_WEBHOOK_URL=""
NEXBOT_CHANNEL_SECRET=""
```

</details>

---

## Architecture Decision Records

| ADR | Decision |
|---|---|
| [ADR-001](docs/adr/ADR-001-baileys-websocket-engine.md) | Baileys as WhatsApp WebSocket engine |
| [ADR-002](docs/adr/ADR-002-postgresql-session-persistence.md) | PostgreSQL for session persistence |
| [ADR-003](docs/adr/ADR-003-max-30-instances-per-pod.md) | Max 30 instances per worker pod |
| [ADR-004](docs/adr/ADR-004-bullmq-message-queues.md) | BullMQ for distributed job processing |
| [ADR-005](docs/adr/ADR-005-ulid-for-event-ids.md) | ULID for event identifiers |
| [ADR-006](docs/adr/ADR-006-stt-in-nexconnect.md) | STT processing inside NexConnect |
| [ADR-007](docs/adr/ADR-007-ocr-tts-outside-nexconnect.md) | OCR/TTS outside NexConnect boundary |
| [ADR-008](docs/adr/ADR-008-srp-refactoring.md) | Service responsibility refactoring |
| [ADR-009](docs/adr/ADR-009-atomic-rate-limiting.md) | Atomic rate limiting with Lua scripts |

---

## SDK & CLI

### TypeScript SDK

```bash
npm install @nexconnect/sdk
```

```typescript
import { NexConnect } from '@nexconnect/sdk';

const client = new NexConnect({
  apiKey: 'nc_your_api_key_here',
  baseUrl: 'https://api.nexconnect.io/v1',
});

// Send a message
await client.messages.send('instance-id', {
  to: '5511999999999',
  type: 'text',
  content: { text: 'Hello from NexConnect!' },
});

// List instances
const { data, meta } = await client.instances.list({ page: 1, limit: 10 });
```

### CLI Tool

```bash
npx @nexconnect/cli instances list
npx @nexconnect/cli messages send --instance <id> --to 5511999999999 --text "Hello"
```

---

## Contributing

This is a private repository. For internal contributors:

1. Create a feature branch from `develop`
2. Follow existing code conventions (ESLint + Prettier enforced)
3. Add tests for new functionality
4. Ensure `pnpm lint && pnpm test` passes
5. Create a PR targeting `develop`

---

<p align="center">
  <sub>Built with precision by <strong>Orbitmind</strong></sub>
</p>

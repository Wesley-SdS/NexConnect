# NexConnect v1.1 — Knowledge Base Completa
## Documento de Referência Técnica — Orbitmind

> **Gerado em:** 2026-03-31
> **Versão:** 1.1
> **Classificação:** CONFIDENCIAL — Orbitmind
> **Propósito:** Base de conhecimento para o projeto NexConnect. Contém inventário completo de arquivos, arquitetura, padrões, módulos, serviços, pipeline, testes e infraestrutura.

---

## 1. VISAO GERAL

O NexConnect e um microservico enterprise de **transporte puro** responsavel por toda a camada de comunicacao WhatsApp do ecossistema NexBot. Sua missao: receber mensagens do WhatsApp, normalizar em payload padronizado e entregar ao NexBot — e entregar respostas do NexBot de volta ao WhatsApp.

**O NexConnect NAO tem:** IA, LLM, OCR, TTS, RAG, Vision. A unica excecao e STT (Whisper) para transcricao de audio como normalizacao de transporte.

### Numeros do Projeto

| Metrica | Valor |
|---|---|
| Arquivos totais | 314 |
| TypeScript (source + tests) | 208 |
| Linhas de codigo TS | 17.773 |
| Test suites | 28 |
| Packages no monorepo | 9 |
| Modulos NestJS | 17 |
| Pipeline stages | 7 |
| Metricas Prometheus | 13 |
| ADRs | 7 |
| Runbooks | 4 |
| K8s manifests | 7 |
| Modelos Prisma | 16 |

---

## 2. STACK TECNOLOGICA

| Camada | Tecnologia | Versao |
|---|---|---|
| Runtime | Node.js + TypeScript | 22 LTS / 5.x |
| Framework | NestJS + Fastify adapter | 11.x |
| WhatsApp Core | @WhiskeySockets/Baileys | latest |
| ORM | Prisma | 6.x |
| Cache / PubSub | Redis (ioredis) | 7.x / 5.4.x |
| Filas | BullMQ | 5.x |
| Storage | Cloudflare R2 (via @aws-sdk/client-s3) | - |
| STT | OpenAI Whisper API | - |
| Observabilidade | OpenTelemetry + Prometheus (prom-client) | 1.x / 15.x |
| Logging | Pino (nestjs-pino) | 9.x |
| Testes | Vitest + Supertest + Testcontainers + Pact | - |
| OpenAPI | @nestjs/swagger | 8.1.x |
| CLI | Commander.js + chalk + ora | 12.x |
| SDK HTTP | undici | 7.x |
| Crypto | bcrypt + Node.js crypto (AES-256-GCM) | - |
| JWT | jsonwebtoken (RS256) | 9.x |
| Imagem | sharp | 0.33.x |
| Container | Docker + Kubernetes (k3s dev) | - |
| CI/CD | GitHub Actions | - |

---

## 3. ARQUITETURA DO MONOREPO

```
nexconnect/
├── apps/
│   ├── api/                          # API Gateway REST (NestJS + Fastify)
│   │   ├── src/
│   │   │   ├── main.ts              # Bootstrap: Fastify, ValidationPipe, CORS, Swagger
│   │   │   ├── app.module.ts        # Root module: imports, guards, interceptors globais
│   │   │   ├── common/
│   │   │   │   ├── decorators/      # @RequiredScopes, @Public, @RateLimit, @CurrentTenant
│   │   │   │   ├── filters/         # GlobalExceptionFilter
│   │   │   │   ├── guards/          # ApiKeyGuard, ScopesGuard, RateLimitGuard, IpAllowlistGuard
│   │   │   │   ├── interceptors/    # Logging, Metrics, PiiRedaction, ResponseTransform, TenantContext
│   │   │   │   ├── middleware/      # CorrelationIdMiddleware (AsyncLocalStorage)
│   │   │   │   └── pipes/          # ParseUUIDPipe
│   │   │   └── modules/
│   │   │       ├── audit/           # GET /tenants/:id/audit-logs
│   │   │       ├── auth/            # ApiKeyGuard, AuthService (bcrypt, scopes)
│   │   │       ├── broadcasts/      # POST /broadcasts (A/B testing, pool rotation, pause/resume)
│   │   │       ├── channels/        # POST /instances/:id/channels/publish, GET /channels
│   │   │       ├── groups/          # 14 endpoints (CRUD, participants, invite, join)
│   │   │       ├── health/          # GET /health, /health/live, /health/ready + NumberHealthCalculator
│   │   │       ├── instances/       # 17 endpoints + QrCodeService, BlacklistService, PresenceController, StoriesController
│   │   │       ├── media/           # MediaUploadService (R2), MediaDownloadService (cache)
│   │   │       ├── messages/        # POST send, GET list + ReactionsController + OutboundPipelineService
│   │   │       ├── metrics/         # GET /metrics (Prometheus text format, 13 metricas)
│   │   │       ├── sandbox/         # Simulate inbound/webhook sem numero real (quota 100/dia, TTL 24h)
│   │   │       ├── scheduling/      # One-time, cron, smart time window com timezone
│   │   │       ├── tenants/         # CRUD + DataRetentionService (@Cron 3AM)
│   │   │       ├── verification/    # Single + batch (100) com cache Redis 24h
│   │   │       └── webhooks/        # WebhookDispatchService (HMAC, payload PRD, rate limit) + replay
│   │   ├── Dockerfile               # Multi-stage: base -> dev -> build -> production
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── worker/                       # Worker pods (Baileys + Pipeline)
│       ├── src/
│       │   ├── main.ts              # Standalone NestJS (sem HTTP), graceful shutdown
│       │   ├── worker.module.ts     # Root: BullModule, EventEmitter, Pino, Database, Redis
│       │   ├── connection/
│       │   │   ├── baileys-connection.service.ts   # WASocket, connect/disconnect, sendMessage, presence, call handler
│       │   │   ├── connection-pool.service.ts      # Pool max 30, event-driven reconnection
│       │   │   ├── session-persistence.service.ts  # AES-256-GCM encrypt/decrypt auth state
│       │   │   └── reconnection.service.ts         # Exponential backoff + jitter + circuit breaker
│       │   ├── pipeline/
│       │   │   ├── message-pipeline.service.ts     # Orquestra 7 stages sequencialmente
│       │   │   └── stages/
│       │   │       ├── deduplication.stage.ts      # Redis KV, TTL 1h
│       │   │       ├── classification.stage.ts     # 14 tipos + UNKNOWN
│       │   │       ├── buffer.stage.ts             # Sliding window 3s, flush por pontuacao/max/tipo
│       │   │       ├── media-processing.stage.ts   # Download Baileys -> R2 + STT para audio
│       │   │       ├── enrichment.stage.ts         # Phone normalizado, tenant, isGroup
│       │   │       ├── presence.stage.ts           # Composing/recording, until_next_message
│       │   │       └── forward.stage.ts            # HMAC + BullMQ dispatch
│       │   ├── services/
│       │   │   ├── speech-to-text.service.ts       # Strategy pattern: Whisper/AssemblyAI/Azure
│       │   │   ├── media-compression.service.ts    # Sharp (imagem) + ffmpeg (video/audio)
│       │   │   ├── media-conversion.service.ts     # WebP->PNG, audio->OGG
│       │   │   ├── video-thumbnail.service.ts      # ffmpeg frame extraction + sharp resize
│       │   │   ├── media-upload.service.ts         # R2 via S3Client
│       │   │   ├── warm-up.service.ts              # 4 fases: 10/50/200/1000 msgs/dia
│       │   │   ├── anti-spam.service.ts            # Blacklist, cooldown, spam detection, send window
│       │   │   └── stt-providers/
│       │   │       ├── stt-provider.interface.ts
│       │   │       ├── whisper.provider.ts          # OpenAI Whisper API (real)
│       │   │       ├── assemblyai.provider.ts       # Stub
│       │   │       └── azure-speech.provider.ts     # Stub
│       │   └── workers/
│       │       ├── message-processor.worker.ts      # Inbound via pipeline
│       │       ├── outbound-message.worker.ts       # Envio via Baileys
│       │       ├── webhook-delivery.worker.ts       # HTTP POST com timeout 10s
│       │       └── scheduled-message.worker.ts      # Busca DB + enfileira outbound
│       ├── Dockerfile
│       ├── package.json
│       └── tsconfig.json
│
├── libs/
│   ├── core/                         # Enums, interfaces, DTOs compartilhados
│   │   └── src/
│   │       ├── enums/index.ts        # 10 enums + WebhookEvent (19 eventos)
│   │       ├── interfaces/           # IPipelineStage, MessageContext, InstanceSettings, WebhookPayload
│   │       └── dtos/                 # CreateInstance, SendMessage, CreateWebhook, Pagination, etc (10 DTOs)
│   │
│   ├── database/                     # Prisma ORM
│   │   └── src/
│   │       ├── prisma.service.ts     # Extends PrismaClient + setTenantContext() para RLS
│   │       └── database.module.ts    # @Global module
│   │
│   ├── redis/                        # Redis wrapper
│   │   └── src/
│   │       ├── redis.service.ts      # get/set/del/incr/incrby/hset/hget/publish/subscribe
│   │       └── redis.module.ts       # @Global module
│   │
│   ├── shared/                       # Utilities compartilhadas
│   │   └── src/
│   │       ├── utils/
│   │       │   ├── crypto.util.ts    # AES-256-GCM, bcrypt, HMAC-SHA256, timingSafeEqual
│   │       │   ├── phone.util.ts     # normalize, isValid, toJid
│   │       │   └── ulid.util.ts      # generate()
│   │       ├── exceptions/
│   │       │   └── nexconnect.exception.ts  # 6 excecoes tipadas
│   │       ├── constants/index.ts    # MAX_INSTANCES_PER_POD=30, TTLs, limites, prefixos Redis
│   │       ├── observability/
│   │       │   ├── tracing.service.ts   # OpenTelemetry SDK + spans
│   │       │   ├── tracing.module.ts    # @Global module
│   │       │   └── pii-redactor.ts      # CPF, CNPJ, cartao, telefone, email
│   │       ├── audit/
│   │       │   ├── audit.service.ts     # INSERT-only audit trail
│   │       │   ├── audit.module.ts      # @Global module
│   │       │   └── audit.decorator.ts   # @Auditable()
│   │       └── auth/
│   │           ├── inter-pod-jwt.service.ts  # RS256 com fallback HMAC
│   │           └── inter-pod-jwt.module.ts
│   │
│   ├── sdk/                          # @nexconnect/sdk
│   │   └── src/
│   │       ├── client.ts            # NexConnect class com 7 resources
│   │       ├── http-client.ts       # undici com retry, error mapping
│   │       ├── errors.ts            # 6 error classes + mapHttpError()
│   │       ├── types.ts             # Todas as interfaces (297 linhas)
│   │       └── resources/           # instances, messages, webhooks, groups, broadcasts, scheduling, sandbox
│   │
│   ├── cli/                          # @nexconnect/cli
│   │   └── src/
│   │       ├── index.ts             # Commander program com 6 comandos
│   │       ├── commands/            # instances, send, messages, logs, webhooks, config
│   │       └── utils/               # config (~/.nexconnect/config.json), output (tabela/JSON), client
│   │
│   └── testing/                      # @nexconnect/testing
│       └── src/
│           ├── setup-containers.ts   # PostgreSQL 16 + Redis 7 via Testcontainers
│           └── test-prisma.service.ts # createTestPrismaClient + cleanDatabase
│
├── prisma/
│   ├── schema.prisma                 # 16 modelos, 9 enums, 7 indices
│   └── migrations/
│       └── rls_policies.sql          # RLS em 12 tabelas + 12 policies
│
├── docs/
│   ├── PRD_v1.1.md                   # PRD completo (55KB)
│   ├── API.md                        # Referencia de endpoints REST
│   ├── ARCHITECTURE.md               # Arquitetura detalhada
│   ├── CONTRIBUTING.md               # Guia de contribuicao
│   ├── DEPLOYMENT.md                 # Deploy K8s + Docker
│   ├── TESTING.md                    # Estrategia de testes
│   ├── KNOWLEDGE_BASE.md             # Este documento
│   ├── adr/                          # 7 ADRs (Baileys, PostgreSQL, 30/pod, BullMQ, ULID, STT, OCR/TTS)
│   └── runbooks/                     # deploy, incident-response, database-migrations, secrets-rotation
│
├── infra/k8s/                        # 7 manifests (namespace, configmap, api-deploy, api-svc, worker-deploy, worker-hpa, kustomization)
├── scripts/setup.sh                  # Script de setup local
├── .github/workflows/ci.yml          # lint -> test -> build -> docker
├── docker-compose.yml                # PostgreSQL + Redis + API + Worker
├── Dockerfile (api + worker)         # Multi-stage builds
├── vitest.config.ts                  # Unit tests
├── vitest.e2e.config.ts              # E2E tests
├── turbo.json                        # Turborepo pipelines
├── tsconfig.base.json                # TypeScript base config
├── eslint.config.mjs                 # ESLint + Prettier
└── .env.example                      # 30+ variaveis de ambiente
```

---

## 4. MODELO DE DADOS (PRISMA)

### 16 Modelos

| Modelo | Campos-chave | Relacoes |
|---|---|---|
| **Tenant** | id (UUID), name, plan (FREE/STARTER/PRO/ENTERPRISE), settings (Json) | hasMany: ApiKey, Instance, Webhook |
| **ApiKey** | id, tenantId, name, keyHash (bcrypt), prefix (nc_xxx), scopes[], active, expiresAt | belongsTo: Tenant |
| **Instance** | id, tenantId, name, phoneNumber, status (5 estados), connectionType, settings (Json), authStateEncrypted (Bytes), podId, healthScore (0-100) | hasMany: Message, Event, Webhook, MediaAsset, ScheduledMessage, CronJob, Blacklist, Whitelist; hasOne: NumberHealth |
| **Webhook** | id, instanceId, tenantId, name, url, testUrl, enabled, testMode, events[], secretEncrypted, retryMaxAttempts (5), retryBackoffBase (2.5) | hasMany: WebhookDelivery |
| **Message** | id (ULID), instanceId, tenantId, waMessageId (UNIQUE), direction, type (15 tipos), content (Json), status (6 estados), sentAt, deliveredAt, readAt, failedAt | hasMany: MediaAsset |
| **Event** | id (ULID), tenantId, instanceId, type, payload (Json), createdAt | hasMany: WebhookDelivery |
| **WebhookDelivery** | id, eventId, webhookId, attempt, status (4 estados), responseCode, responseBody, durationMs | belongsTo: Event, Webhook |
| **MediaAsset** | id, tenantId, instanceId, messageId, type (5 tipos), r2Key, url, sizeBytes, mimeType, transcription (STT only) | belongsTo: Instance, Message |
| **NumberHealth** | id, instanceId (UNIQUE), score, responseRate, readRate, bounceRate, volumeScore, calculatedAt | belongsTo: Instance |
| **ScheduledMessage** | id, instanceId, tenantId, payload (Json), status, sendAt, cron, attempt | belongsTo: Instance |
| **AuditLog** | id, tenantId, actorId, action, resourceType, resourceId, ip, metadata (Json) | - |
| **CronJob** | id, instanceId, name, cronExpression, to, type, content, timezone, active | belongsTo: Instance |
| **Broadcast** | id, tenantId, instanceIds[], totalRecipients, type, content, status, sentCount, failedCount, strategy, sendWindow, variants | - |
| **Blacklist** | id, instanceId, phone, reason, failCount, expiresAt | belongsTo: Instance |
| **Whitelist** | id, instanceId, phone | belongsTo: Instance |
| **SandboxSession** | id, tenantId, name, status, settings, expiresAt | - |

### Indices Criticos

- `instances(tenant_id, status)` — listagem filtrada
- `messages(instance_id, direction, created_at DESC)` — historico
- `messages(wa_message_id) UNIQUE` — deduplicacao
- `events(tenant_id, type, created_at)` — replay
- `webhook_deliveries(event_id, status)` — monitoramento
- `audit_logs(tenant_id, created_at DESC)` — auditoria
- `blacklist(instance_id, phone) UNIQUE`
- `whitelist(instance_id, phone) UNIQUE`

---

## 5. PIPELINE DE MENSAGENS INBOUND (7 STAGES)

```
Baileys WebSocket Event
  -> 1. Deduplication    (Redis KV, TTL 1h, key: dedup:msg:{instanceId}:{messageId})
  -> 2. Classification   (14 tipos Baileys -> MessageType enum)
  -> 3. Buffer           (Sliding window 3s, flush por pontuacao/max/tipo-change)
  -> 4. Media Processing (Download Baileys -> Upload R2 -> STT Whisper para audio)
  -> 5. Enrichment       (Phone normalizado, tenantId, isGroup, profileName)
  -> 6. Presence         (Composing/recording via Baileys, strategy until_next_message)
  -> 7. Forward          (HMAC-SHA256, BullMQ dispatch, 5 retries, dead letter)
```

### Detalhes por Stage

| Stage | Classe | Linhas | Deps | SRP |
|---|---|---|---|---|
| Deduplication | MessageDeduplicationStage | 36 | RedisService | Apenas dedup |
| Classification | MessageClassificationStage | 88 | - | Apenas classificacao |
| Buffer | MessageBufferStage | 157 | RedisService | Apenas buffering |
| Media Processing | MediaProcessingStage | 119 | MediaUploadService, SpeechToTextService | Apenas midia+STT |
| Enrichment | MessageEnrichmentStage | 76 | PrismaService | Apenas metadados |
| Presence | PresenceUpdateStage | 65 | BaileysConnectionService, RedisService | Apenas presence |
| Forward | WebhookForwardStage | 132 | PrismaService, Queue | Apenas dispatch |

---

## 6. FLUXO DE REQUEST HTTP

```
1. CorrelationIdMiddleware     -> Gera/propaga x-correlation-id (ULID, AsyncLocalStorage)
2. ApiKeyGuard                 -> Valida Bearer nc_xxx, injeta tenant/scopes no request
3. ScopesGuard                 -> Verifica scopes (admin bypassa)
4. RateLimitGuard              -> Redis sliding window (1000/100/10 por min)
5. IpAllowlistGuard            -> CIDR match contra tenant.settings.ipAllowlist
6. TenantContextInterceptor    -> prisma.setTenantContext(tenantId) para RLS
7. Controller -> Service       -> Logica de negocio
8. ResponseTransformInterceptor -> Envelope { success: true, data }
9. MetricsInterceptor          -> http_requests_total + http_request_duration_ms
10. PiiRedactionInterceptor    -> Redacao de CPF/CNPJ/cartao/telefone/email em logs
11. LoggingInterceptor         -> Pino structured log com method, url, status, duration
```

---

## 7. SEGURANCA

### Camadas de Protecao

| Camada | Implementacao |
|---|---|
| API Keys | bcrypt salt 12, prefixo nc_, hash SHA-256, scopes (read/send/admin) |
| HMAC Webhook | SHA-256 com crypto.timingSafeEqual (nao comparacao direta) |
| Auth State | AES-256-GCM com IV unico por registro, Bytes no PostgreSQL |
| Rate Limiting | Redis sliding window: 1000 req/min (key), 100 msg/min (instance), 10 msg/min (recipient), 500 webhook/min, 50MB media/min |
| RLS | PostgreSQL Row-Level Security em 12 tabelas + PrismaService.setTenantContext() |
| IP Allowlist | Guard com suporte CIDR por tenant |
| JWT Inter-Pod | RS256 com fallback HMAC, tokens efemeros 5min |
| PII Redaction | CPF, CNPJ, cartao credito, telefone BR, email — 12 patterns regex |
| Audit Trail | INSERT-only na tabela audit_logs |
| Data Retention | Cron diario 3AM, configuravel por tenant (default 365 dias) |

### Hierarquia de Excecoes

```
NexConnectException (base, HttpException)
├── InstanceNotFoundException (404)
├── InstanceOfflineException (409)
├── RateLimitExceededException (429)
├── InvalidPhoneNumberException (400)
├── MediaProcessingException (422)
└── WebhookDeliveryException (502)
```

---

## 8. OBSERVABILIDADE

### OpenTelemetry
- NodeSDK com BatchSpanProcessor + OTLPTraceExporter
- Spans por pipeline stage com attributes: instanceId, messageType, tenantId
- Endpoint configuravel via OTEL_EXPORTER_OTLP_ENDPOINT

### Prometheus (13 metricas)
- `nexconnect_messages_received_total` (counter, labels: instance_id, type)
- `nexconnect_messages_sent_total` (counter, labels: instance_id, type, status)
- `nexconnect_messages_failed_total` (counter, labels: instance_id, error_code)
- `nexconnect_webhook_delivery_duration_ms` (histogram)
- `nexconnect_media_processing_duration_ms` (histogram, labels: type)
- `nexconnect_stt_transcription_duration_ms` (histogram, labels: provider)
- `nexconnect_number_health_score` (gauge, labels: instance_id)
- `nexconnect_connection_uptime_seconds` (gauge, labels: instance_id)
- `nexconnect_active_instances` (gauge)
- `nexconnect_buffer_flush_total` (counter, labels: instance_id, reason)
- `nexconnect_pipeline_stage_duration_ms` (histogram, labels: stage)
- `nexconnect_http_requests_total` (counter, labels: method, path, status)
- `nexconnect_http_request_duration_ms` (histogram, labels: method, path)

### Logging (Pino)
- JSON em production, colorized em development
- Redact automatico de req.headers.authorization
- Zero console.log em codigo server-side
- Correlation ID propagado via AsyncLocalStorage

---

## 9. PROTECAO DE NUMERO

### Health Score (0-100)

| Componente | Peso |
|---|---|
| Taxa de resposta | 30% |
| Taxa de leitura | 20% |
| Taxa de bounces | 20% |
| Idade da instancia | 15% |
| Volume relativo | 15% |

### Throttle Actions

| Score | Acao | Delay Multiplier |
|---|---|---|
| > 80 | normal | 1.0x |
| 60-80 | light_throttle | 1.2x (+20%) |
| 40-60 | heavy_throttle | 2.0x (-50% volume) |
| < 40 | pause_proactive | Infinity (apenas respostas) |

### Warm-up Automatico

| Dia | Limite | Delay |
|---|---|---|
| 1-3 | 10 msgs/dia | 15-30s |
| 4-7 | 50 msgs/dia | 5-15s |
| 8-14 | 200 msgs/dia | 2-8s |
| 15-30 | 1.000 msgs/dia | 1-3s |
| 30+ | Configurado | Configurado |

### Anti-Spam
- Blacklist automatica apos 5 falhas consecutivas (expira 7 dias)
- Cooldown 60s entre mensagens para mesmo numero
- Deteccao de padrao: >70% sem resposta em 48h = throttle
- Send window: verifica timezone do tenant

---

## 10. WEBHOOKS

### 19 Eventos

**Instancia:** connected, disconnected, qrcode, mentioned, health_warning
**Mensagem:** received, sent, delivered, read, deleted, reaction, pinned, unpinned
**Grupo:** created, updated, participants_added, participants_removed, participants_promoted, participants_demoted

### Payload Padrao

```json
{
  "id": "ULID",
  "type": "message.received",
  "instance_id": "ins_...",
  "tenant_id": "ten_...",
  "created_at": "ISO8601",
  "data": {},
  "meta": { "delivery_attempt": 1, "replay": false }
}
```

### Headers

```
X-NexConnect-Signature: sha256=<hmac_hex>
X-NexConnect-Event: <event_type>
X-NexConnect-Delivery-Id: <ulid>
X-NexConnect-Timestamp: <iso8601>
Content-Type: application/json
User-Agent: NexConnect-Webhook/1.0
```

### Retry: 5 tentativas, backoff exponencial configuravel. Dead letter apos esgotamento.

---

## 11. ENDPOINTS REST (API)

### Instances (17 endpoints)
- POST /v1/instances — criar
- GET /v1/instances — listar
- GET /v1/instances/:id — detalhes
- PATCH /v1/instances/:id — atualizar settings
- DELETE /v1/instances/:id — soft delete
- GET /v1/instances/:id/qrcode — base64 + SVG + expiresAt
- POST /v1/instances/:id/pairing-code — codigo 8 digitos
- POST /v1/instances/:id/power-on — restaura sessao
- POST /v1/instances/:id/power-off — desliga, persiste
- POST /v1/instances/:id/restart — power-off + power-on
- PATCH /v1/instances/:id/profile — nome, foto, bio
- GET /v1/instances/:id/health — health check
- GET /v1/instances/:id/metrics — 10 metricas
- POST /v1/instances/:id/webhooks — criar webhook
- PATCH /v1/instances/:id/webhooks/:wid — atualizar
- DELETE /v1/instances/:id/webhooks/:wid — excluir
- POST /v1/instances/:id/webhooks/:wid/test — testar

### Messages (5 endpoints)
- POST /v1/instances/:id/messages — enviar
- GET /v1/instances/:id/messages — listar (paginado, filtros)
- GET /v1/instances/:id/messages/:msgId — detalhes
- POST /v1/instances/:id/messages/:msgId/reactions — reagir
- DELETE /v1/instances/:id/messages/:msgId/reactions — remover reacao

### Groups (14 endpoints)
- CRUD grupos + participants add/remove/promote/demote + join/invite/revoke/settings

### Webhooks
- POST /v1/events/replay — replay com filtros (from, to, eventTypes, instanceId, targetUrl)

### Scheduling
- CRUD scheduled messages + CRUD cron jobs + smart schedule com timezone

### Broadcasts
- POST /v1/broadcasts — criar (A/B testing, strategies: round_robin/health_based/random)
- GET /v1/broadcasts — listar
- GET /v1/broadcasts/:id — detalhes
- PATCH /v1/broadcasts/:id/status — pausar/resumir

### Verificacao
- GET /v1/instances/:id/recipients/:number — single
- POST /v1/instances/:id/recipients/batch — lote (max 100)

### Presence
- PATCH /v1/instances/:id/presence — typing/recording

### Stories
- GET /v1/instances/:id/stories — listar
- POST /v1/instances/:id/stories/text — publicar texto
- POST /v1/instances/:id/stories/media — publicar midia
- DELETE /v1/instances/:id/stories/:storyId — remover

### Channels
- POST /v1/instances/:id/channels/publish — publicar
- GET /v1/instances/:id/channels — listar

### Sandbox
- POST /v1/sandbox/instances — criar sessao
- POST /v1/sandbox/simulate/inbound — simular mensagem
- POST /v1/sandbox/simulate/webhook — simular evento
- GET /v1/sandbox/sessions — listar
- DELETE /v1/sandbox/sessions/:id — encerrar

### Health
- GET /v1/health — status geral
- GET /v1/health/live — liveness probe
- GET /v1/health/ready — readiness probe (verifica DB + Redis)

### Metrics
- GET /v1/metrics — Prometheus text format

### Audit
- GET /v1/tenants/:id/audit-logs — paginado, filtros

### Tenants
- CRUD + GET /tenants/:id/data/export + DELETE /tenants/:id/data (LGPD)

---

## 12. TESTES

### 28 Test Suites

**API (13):**
- api-key.guard.spec.ts, rate-limit.guard.spec.ts
- auth.service.spec.ts, instances.service.spec.ts, messages.service.spec.ts
- webhook-dispatch.service.spec.ts, number-health-calculator.service.spec.ts
- metrics.service.spec.ts, sandbox.service.spec.ts, verification.service.spec.ts
- instances.integration.spec.ts (Testcontainers)
- app.e2e.spec.ts (Supertest)
- nexbot-consumer.pact.spec.ts (Contract)

**Worker (10):**
- deduplication.stage.spec.ts, classification.stage.spec.ts, buffer.stage.spec.ts
- enrichment.stage.spec.ts, forward.stage.spec.ts
- message-pipeline.service.spec.ts, connection-pool.service.spec.ts
- speech-to-text.service.spec.ts, warm-up.service.spec.ts, anti-spam.service.spec.ts

**Libs (5):**
- crypto.util.spec.ts, phone.util.spec.ts, pii-redactor.spec.ts
- client.spec.ts, http-client.spec.ts (SDK)

---

## 13. DECISOES TECNICAS (ADRs)

| ADR | Decisao | Justificativa |
|---|---|---|
| 001 | Baileys como engine | WebSocket direto, ~10x menos RAM (50-150MB vs 400-800MB Puppeteer) |
| 002 | PostgreSQL para sessions | Durabilidade, consistencia, queries por pod |
| 003 | 30 instancias/pod | ~3-4GB RAM por pod, dentro do limite 6GB |
| 004 | BullMQ para filas | Priority queues, rate limiting, Redis ja e dependencia |
| 005 | ULID para IDs | Ordenavel, sem colisao, safe para exposicao |
| 006 | STT no NexConnect | Normalizacao de transporte, NexBot recebe payload pronto |
| 007 | OCR/TTS fora | OCR = Vektus, TTS = NexBot via AI Gateway |

---

## 14. INFRAESTRUTURA

### Docker Compose (Desenvolvimento)
- PostgreSQL 16-alpine (porta 5432)
- Redis 7-alpine (porta 6379, maxmemory 256mb)
- API (porta 3100)
- Worker

### Kubernetes (Producao)
- API: 2 replicas, 512Mi-1Gi, rollingUpdate maxUnavailable:0
- Worker: 10 replicas (300 instancias), 4Gi-6Gi, HPA min:2 max:50
- HPA: metrica active_instances avg 25, memory 75%
- Probes: readiness + liveness + startup em /v1/health

### CI/CD (GitHub Actions)
- lint -> test (PostgreSQL + Redis services) -> build -> docker (push main)

---

## 15. FRONTEIRAS DE RESPONSABILIDADE

| Responsabilidade | NexConnect | NexBot | Vektus |
|---|---|---|---|
| Conexao WebSocket WhatsApp | SIM | - | - |
| Buffer / dedup / classificacao | SIM | - | - |
| Download midia -> upload R2 | SIM | - | - |
| STT (transcricao audio) | SIM | - | - |
| Session persistence / health | SIM | - | - |
| HMAC / seguranca webhook | SIM | - | - |
| OCR de imagens | - | - | SIM |
| RAG / busca semantica | - | - | SIM |
| TTS (geracao de .ogg) | - | SIM | - |
| Vision LLM / analise imagem | - | SIM | - |
| Inferencia LLM | - | SIM | - |
| Agent Builder / Analytics | - | SIM | - |

---

## 16. PADROES DE DESIGN

- **Pipeline Pattern** — 7 stages sequenciais com halt condicional
- **Circuit Breaker** — reconnection com cooldown 5min apos 10 falhas
- **Strategy Pattern** — STT providers, broadcast strategies, presence strategies
- **Event-Driven** — EventEmitter2 para Baileys events, BullMQ para jobs
- **Pool Pattern** — max 30 instancias por pod com redistribuicao
- **Singleton** — PrismaService, RedisService (Global modules)
- **Decorator Pattern** — @RequiredScopes, @Public, @RateLimit, @Auditable, @CurrentTenant
- **Guard Chain** — ApiKey -> Scopes -> RateLimit -> IpAllowlist
- **Interceptor Chain** — TenantContext -> ResponseTransform -> Metrics -> PiiRedaction -> Logging
- **HMAC Signing** — SHA-256 com timingSafeEqual em webhooks
- **Encryption at Rest** — AES-256-GCM para auth state Baileys

---

*NexConnect Knowledge Base v1.1 — CONFIDENCIAL — Orbitmind — Marco 2026*

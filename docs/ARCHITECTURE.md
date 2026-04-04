# Arquitetura NexConnect

## Princípios Arquiteturais

1. **Transporte puro** — zero IA, zero lógica de negócio, apenas normalização e entrega
2. **Clean Code** — nomenclatura expressiva, funções pequenas, responsabilidade única
3. **SOLID** — SRP estrito, Open/Closed, LSP, ISP, DIP
4. **Fail-fast** — erros detectados o mais cedo possível
5. **Observability-first** — logs estruturados, métricas e traces desde o dia 1
6. **Security by default** — criptografia em repouso, HMAC em trânsito
7. **Horizontal scalability** — zero estado local em memória

---

## Visão de Alto Nível

```
┌─────────────────────────────────────────────────────────────────┐
│                    NexConnect Cluster                           │
│                                                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐      │
│  │  Worker Pod 1 │  │  Worker Pod 2 │  │  Worker Pod N │      │
│  │  ~30 instancias│  │  ~30 instancias│  │  ~30 instancias│   │
│  │  Baileys WS   │  │  Baileys WS   │  │  Baileys WS   │      │
│  │  Message Proc │  │  Message Proc │  │  Message Proc │      │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘      │
│          └──────────────────┼──────────────────┘               │
│                             |                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Redis Cluster (Pub/Sub + Cache + Queues)         │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          API Gateway + Instance Manager (NestJS)         │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         PostgreSQL (sessions + events + messages)        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Monorepo Structure

```
nexconnect/
├── apps/
│   ├── api/                      # API Gateway (REST)
│   │   └── src/
│   │       ├── main.ts           # Bootstrap Fastify + NestJS
│   │       ├── app.module.ts     # Root module
│   │       ├── modules/          # Feature modules
│   │       │   ├── auth/         # API Key auth, guards
│   │       │   ├── instances/    # Instance CRUD + lifecycle
│   │       │   ├── messages/     # Send + list messages
│   │       │   ├── webhooks/     # Webhook CRUD + replay
│   │       │   ├── groups/       # Group management
│   │       │   ├── media/        # Media upload/download
│   │       │   ├── scheduling/   # Scheduled messages
│   │       │   ├── broadcasts/   # Broadcast engine
│   │       │   ├── health/       # Number health score
│   │       │   └── tenants/      # Tenant management
│   │       └── common/           # Shared API concerns
│   │           ├── guards/       # ApiKeyGuard, ScopesGuard
│   │           ├── filters/      # GlobalExceptionFilter
│   │           ├── interceptors/ # Logging, ResponseTransform
│   │           ├── pipes/        # Validation pipes
│   │           └── decorators/   # @CurrentTenant, @RequiredScopes
│   │
│   └── worker/                   # Worker pods
│       └── src/
│           ├── main.ts           # Standalone bootstrap
│           ├── pipeline/         # Message processing pipeline
│           │   ├── stages/       # 7 pipeline stages (SRP)
│           │   │   ├── deduplication.stage.ts
│           │   │   ├── classification.stage.ts
│           │   │   ├── buffer.stage.ts
│           │   │   ├── media-processing.stage.ts
│           │   │   ├── enrichment.stage.ts
│           │   │   ├── presence.stage.ts
│           │   │   └── forward.stage.ts
│           │   └── message-pipeline.service.ts
│           ├── connection/       # Baileys connection management
│           │   ├── baileys-connection.service.ts
│           │   ├── connection-pool.service.ts
│           │   ├── session-persistence.service.ts
│           │   └── reconnection.service.ts
│           ├── workers/          # BullMQ workers
│           └── services/         # STT, media, compression
│
├── libs/
│   ├── core/                     # Shared domain
│   │   └── src/
│   │       ├── enums/            # InstanceStatus, MessageType, etc
│   │       ├── interfaces/       # IPipelineStage, MessageContext, etc
│   │       └── dtos/             # CreateInstanceDto, SendMessageDto, etc
│   ├── database/                 # Prisma
│   │   └── src/
│   │       ├── prisma.service.ts # PrismaService (NestJS injectable)
│   │       └── database.module.ts
│   ├── redis/                    # Redis
│   │   └── src/
│   │       ├── redis.service.ts  # RedisService wrapper
│   │       └── redis.module.ts
│   └── shared/                   # Utilities
│       └── src/
│           ├── exceptions/       # NexConnectException hierarchy
│           ├── constants/        # MAX_INSTANCES_PER_POD, etc
│           └── utils/            # PhoneUtil, CryptoUtil, UlidUtil
│
├── prisma/
│   └── schema.prisma             # Database schema
├── docs/                         # Documentation
└── docker-compose.yml            # Local infra
```

---

## Pipeline de Mensagens (Inbound)

Cada estágio implementa `IPipelineStage` com método `process(context: MessageContext)`.

### Stage 1: Deduplication
- Verifica Redis por `message_id` com TTL 1h
- Duplicata -> descarta silenciosamente
- SRP: apenas deduplicação

### Stage 2: Classification
- Identifica tipo (15 tipos suportados)
- Mapeia mensagem Baileys -> MessageType enum
- SRP: apenas classificação

### Stage 3: Buffer
- Acumula texto em sliding window (3000ms default)
- Flush por: timeout, pontuação final, tamanho máximo, mudança de tipo
- Adaptativo: aprende padrão do usuário
- SRP: apenas buffering de texto

### Stage 4: Media Processing
- Download binário via Baileys
- Upload para R2 (URL permanente)
- Para áudio: executa STT via Whisper
- NÃO faz OCR, TTS ou Vision
- SRP: apenas transporte de mídia + STT

### Stage 5: Enrichment
- Adiciona: contact profile, tenant_id, is_group, phone normalizado
- SRP: apenas enriquecimento de metadados

### Stage 6: Presence
- Envia "digitando..." via Baileys
- Strategy: until_next_message ou maximum_duration
- SRP: apenas presence update

### Stage 7: Forward
- Constrói payload normalizado (PRD 17.1)
- Assina com HMAC-SHA256
- Enfileira entrega via BullMQ
- SRP: apenas dispatch de webhook

---

## Decisões Técnicas (ADRs)

| ADR | Decisão | Justificativa |
|---|---|---|
| ADR-001 | Baileys como engine | WebSocket direto, sem browser, ~10x menos RAM |
| ADR-002 | PostgreSQL para sessions | Durabilidade, consistência, queries eficientes |
| ADR-003 | 30 instâncias/pod | ~3-4GB RAM por pod, dentro do limite de 6GB |
| ADR-004 | BullMQ para filas | Priority queues, rate limiting, delayed jobs |
| ADR-005 | ULID para IDs | Ordenável, sem colisão, safe para exposição |
| ADR-006 | STT no NexConnect | Normalização de transporte, não inferência |
| ADR-007 | OCR/TTS fora | OCR = Vektus, TTS = NexBot via AI Gateway |

---

## Segurança

### Camadas de Proteção

1. **API Keys** — bcrypt hash, prefixo `nc_`, scopes granulares
2. **HMAC-SHA256** — assinatura em todo webhook
3. **AES-256-GCM** — auth state Baileys em repouso
4. **Rate Limiting** — por API key, instância, destinatário
5. **PII Redaction** — logs sem dados sensíveis (LGPD)
6. **Audit Trail** — toda operação sensível registrada
7. **RLS** — isolamento por tenant_id no PostgreSQL

### Criptografia

| Dado | Método |
|---|---|
| API Keys | bcrypt (salt 12) |
| Auth State | AES-256-GCM |
| Webhook Secrets | AES-256 |
| URLs de Mídia | Assinadas com TTL |
| Inter-serviços | TLS 1.3 |

---

## Observabilidade

| Componente | Tecnologia |
|---|---|
| Traces | OpenTelemetry -> Jaeger |
| Métricas | Prometheus + Grafana |
| Logs | Pino (JSON) -> Loki |
| Alertas | Grafana Alerting |
| Load Testing | k6 |

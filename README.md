<p align="center">
  <img src="https://img.shields.io/badge/Node.js-22_LTS-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Prisma-6-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Kubernetes-Ready-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white" alt="Kubernetes" />
</p>

<h1 align="center">NexConnect</h1>

<p align="center">
  <strong>Motor Enterprise de WhatsApp para o ecossistema NexBot</strong>
</p>

<p align="center">
  <a href="#sobre-o-projeto">Sobre</a> &bull;
  <a href="#destaques-tecnicos">Destaques</a> &bull;
  <a href="#inicio-rapido">Inicio Rapido</a> &bull;
  <a href="#arquitetura">Arquitetura</a> &bull;
  <a href="#referencia-da-api">API</a> &bull;
  <a href="#seguranca">Seguranca</a> &bull;
  <a href="#observabilidade">Observabilidade</a> &bull;
  <a href="#testes">Testes</a> &bull;
  <a href="#deploy">Deploy</a>
</p>

---

## Sobre o Projeto

O **NexConnect** e um microservico enterprise **multi-tenant** projetado para ser a **camada de transporte completa de WhatsApp** do ecossistema NexBot. Ele nao contem logica de IA, nao processa linguagem natural e nao toma decisoes de negocio — seu unico proposito e garantir que **cada mensagem do WhatsApp chegue ao destino certo, no formato certo, com seguranca, velocidade e confiabilidade de nivel enterprise**.

Na pratica, o NexConnect e o motor silencioso por tras de toda comunicacao WhatsApp: ele gerencia centenas de conexoes simultaneas via WebSocket, processa mensagens atraves de um pipeline de 7 estagios com deduplicacao, classificacao automatica de 15+ tipos de mensagem, buffering inteligente com janela deslizante adaptativa, download e upload de midias para Cloudflare R2, transcricao automatica de audio (Speech-to-Text com suporte a Whisper, AssemblyAI e Azure), enriquecimento de metadados e entrega via webhooks assinados com HMAC-SHA256. Tudo isso com retry automatico, dead letter queue, replay de eventos e circuit breaker.

O sistema foi construido para escalar horizontalmente: cada worker pod gerencia ate 30 instancias WhatsApp, e o Horizontal Pod Autoscaler do Kubernetes escala automaticamente de 2 a 50 pods baseado em metricas customizadas. A arquitetura multi-tenant usa **Row-Level Security no PostgreSQL** para isolamento absoluto de dados entre tenants, combinado com isolamento na camada de aplicacao.

### O que o NexConnect faz

- **Gerencia conexoes WhatsApp** — Pool de conexoes Baileys com reconexao automatica, persistencia de sessao criptografada (AES-256-GCM) e limite configuravel por pod
- **Processa mensagens recebidas** — Pipeline de 7 estagios: deduplicacao (Redis TTL 1h), classificacao (15+ tipos), buffer adaptativo (janela deslizante 3s), processamento de midia (download + R2 + STT), enriquecimento, presenca e encaminhamento
- **Valida e envia mensagens** — Pipeline de 4 estagios: validacao de campos, verificacao de telefone (E.164), anti-spam atomico (Lua scripts no Redis), preparacao de midia com rate limit
- **Distribui broadcasts** — Campanhas de envio em massa com balanceamento multi-instancia (round-robin, health-based, random), testes A/B com variantes ponderadas e delay configuravel
- **Entrega eventos via webhook** — Assinatura HMAC-SHA256, retry exponencial configuravel (ate 5 tentativas), dead letter queue, modo de teste com URL alternativa e replay de eventos historicos
- **Protege a saude do numero** — Score de 0-100 com 5 fatores ponderados, throttling automatico progressivo (leve, forte, pausa), warm-up gradual para numeros novos
- **Agenda mensagens** — Envio programado com data futura, cron jobs recorrentes com timezone, smart scheduling com janela de envio
- **Gerencia grupos** — CRUD completo, adicionar/remover/promover/rebaixar participantes
- **Transcricao de audio** — STT plugavel com 3 providers (Whisper, AssemblyAI, Azure Speech) como parte da normalizacao de mensagens

### Fronteiras de Responsabilidade

| Responsabilidade | NexConnect | NexBot | Vektus |
|---|---|---|---|
| Conexao WebSocket WhatsApp (Baileys) | Sim | - | - |
| Buffer / deduplicacao / classificacao | Sim | - | - |
| Download de midia + upload R2 | Sim | - | - |
| STT (transcricao de audio recebido) | Sim | - | - |
| Persistencia de sessao / health score | Sim | - | - |
| HMAC / seguranca de webhook | Sim | - | - |
| Rate limiting atomico multinivel | Sim | - | - |
| Broadcasts com A/B testing | Sim | - | - |
| Agendamento e cron jobs | Sim | - | - |
| Compliance LGPD (redacao PII, export, erasure) | Sim | - | - |
| OCR de imagens | - | - | Sim |
| TTS (geracao de .ogg) | - | Sim | - |
| Inferencia LLM / agentes IA | - | Sim | - |
| RAG / Base de Conhecimento | - | - | Sim |

---

## Destaques Tecnicos

### Arquitetura

- **Monorepo Turborepo** com pnpm workspaces — 7 pacotes compartilhados, 2 aplicacoes
- **NestJS 11 + Fastify 5** — Framework enterprise com injecao de dependencia e HTTP de alta performance
- **SOLID completo** — Services com responsabilidade unica, Strategy Pattern para broadcasts, Pipeline Pattern para processamento de mensagens, DIP com abstracoes em todas as camadas
- **14 modulos de dominio** desacoplados (auth, instances, messages, webhooks, broadcasts, scheduling, groups, channels, health, metrics, tenants, verification, sandbox, audit)

### Seguranca

- **Autenticacao O(1)** — Lookup por prefix + cache Redis com invalidacao automatica no revoke
- **Rate limiting atomico** — Scripts Lua no Redis eliminam race conditions entre INCR e EXPIRE
- **Isolamento multi-tenant** — Row-Level Security no PostgreSQL + filtro na camada de aplicacao
- **Criptografia AES-256-GCM** — Sessions Baileys e webhook secrets encriptados em repouso
- **LGPD compliance** — Redacao automatica de PII em logs (CPF, CNPJ, telefone, email, cartao de credito), exportacao de dados e direito ao esquecimento

### Resiliencia

- **Circuit Breaker** — 3 estados (CLOSED/OPEN/HALF_OPEN) com threshold e timeout configuraveis
- **Graceful Shutdown** — Drena requests em andamento (30s timeout) antes de fechar
- **Retry exponencial** — Jobs BullMQ com 3 tentativas e backoff configuravel
- **HPA Kubernetes** — Auto-scaling de 2 a 50 pods baseado em metricas customizadas

### Observabilidade

- **Logging estruturado** com Pino — `RequestLogger` com propagacao de contexto via AsyncLocalStorage
- **Distributed tracing** — OpenTelemetry com spans em HTTP, BullMQ jobs e queries Prisma
- **Metricas Prometheus** — Contadores e histogramas por rota, status e tenant
- **Decorator `@LogContext()`** — Logging automatico de inicio/sucesso/erro com duracao em metodos de servico

### Qualidade de Codigo

- **0 `as any` em codigo de producao da API** — Type safety completo com `Prisma.JsonValue` e tipos adequados
- **0 magic numbers** — Todas as constantes nomeadas e centralizadas em `@nexconnect/shared`
- **44 arquivos de teste** — Vitest + Supertest + Testcontainers + Pact (contract testing)
- **100% cobertura** em guards, filters, pipes e pipeline stages
- **9 ADRs** documentando decisoes arquiteturais

---

## Stack Tecnologica

| Camada | Tecnologia | Versao | Proposito |
|---|---|---|---|
| **Runtime** | Node.js + TypeScript | 22 LTS / 5.7 | Runtime async moderno com tipagem estrita |
| **Framework** | NestJS + Fastify | 11.x / 5.x | Framework enterprise com DI e HTTP de alta performance |
| **WhatsApp** | @WhiskeySockets/Baileys | latest | Protocolo WebSocket do WhatsApp Web |
| **Banco de Dados** | PostgreSQL + Prisma | 16 / 6.x | Dados multi-tenant com Row-Level Security |
| **Cache** | Redis + ioredis | 7.x / 5.x | Rate limiting atomico, cache, pub/sub |
| **Filas** | BullMQ | 5.x | Processamento distribuido de jobs com retry |
| **Storage** | Cloudflare R2 | - | Armazenamento de arquivos de midia (S3-compativel) |
| **STT** | Whisper / AssemblyAI / Azure | - | Transcricao de audio (plugavel) |
| **Observabilidade** | OpenTelemetry + Prometheus + Pino | - | Tracing distribuido, metricas e logs estruturados |
| **Testes** | Vitest + Supertest + Testcontainers + Pact | - | Testes unitarios, integracao, E2E e contrato |
| **Monorepo** | Turborepo + pnpm workspaces | - | Build eficiente multi-pacote |
| **Deploy** | Docker + Kubernetes (Kustomize) | - | Containerizacao e orquestracao |

---

## Inicio Rapido

### Pre-requisitos

| Ferramenta | Versao |
|---|---|
| Node.js | >= 22.0.0 |
| pnpm | >= 9.0.0 |
| Docker | Latest |

### Instalacao

```bash
# Clone e instale
git clone <repo-url> nexconnect && cd nexconnect
pnpm install

# Configure o ambiente
cp .env.example .env

# Suba a infra local
docker compose up -d postgres redis

# Configure o banco de dados
pnpm db:generate
pnpm db:migrate

# Inicie em desenvolvimento
pnpm dev:api      # API Gateway na porta 3100
pnpm dev:worker   # Worker service
```

### Setup com um comando

```bash
./scripts/setup.sh
```

### Docker Compose completo

```bash
docker compose up -d   # Sobe PostgreSQL, Redis, API e Worker
```

### Comandos uteis

```bash
pnpm build            # Build de todos os pacotes
pnpm lint             # Executa ESLint
pnpm format           # Executa Prettier
pnpm test             # Testes unitarios
pnpm test:cov         # Testes com relatorio de cobertura
pnpm test:e2e         # Testes end-to-end
pnpm db:studio        # Abre Prisma Studio GUI
pnpm db:seed          # Popula dados de desenvolvimento
```

---

## Arquitetura

### Estrutura do Monorepo

```
nexconnect/
├── apps/
│   ├── api/                  # API Gateway REST (NestJS + Fastify)
│   └── worker/               # Worker WhatsApp (Baileys + BullMQ)
│
├── libs/
│   ├── core/                 # DTOs, enums e interfaces compartilhados
│   ├── database/             # Prisma ORM + contexto multi-tenant
│   ├── redis/                # Cliente Redis com operacoes Lua atomicas
│   ├── shared/               # Auth, crypto, observabilidade, resiliencia, compliance
│   ├── sdk/                  # SDK TypeScript para consumidores da API
│   ├── cli/                  # Ferramenta CLI (comando nexconnect)
│   └── testing/              # Utilitarios Testcontainers
│
├── prisma/                   # Schema, migracoes, politicas RLS
├── infra/k8s/                # Manifests Kubernetes (Kustomize)
├── docs/adr/                 # Registros de Decisao Arquitetural
└── scripts/                  # Scripts de automacao
```

### Camadas do Sistema

```
┌──────────────────────────────────────────────────────────┐
│                      API Gateway                          │
│   Guards → Interceptors → Controllers → Services          │
├──────────────────────────────────────────────────────────┤
│                    Camada de Servicos                      │
│   InstancesService  │  LifecycleService  │  MetricsService│
│   MessagesService   │  BroadcastsService │  WebhooksService│
│   SchedulingService │  HealthCheckService │  TenantsService │
├──────────────────────────────────────────────────────────┤
│                  Fila de Jobs (BullMQ)                     │
│   outbound-messages │ broadcast-messages │ webhook-dispatch│
│   instance-lifecycle │ scheduled-messages │ verification   │
├──────────────────────────────────────────────────────────┤
│                    Worker Pods                             │
│   Connection Pool → Pipeline Inbound → Forward Webhook    │
├──────────────────────────────────────────────────────────┤
│                    Infraestrutura                          │
│   PostgreSQL (RLS) │ Redis (Lua) │ Cloudflare R2 │ OTEL  │
└──────────────────────────────────────────────────────────┘
```

### Pipeline de Mensagens Recebidas (Worker)

```
Evento WhatsApp (Baileys WebSocket)
  │
  ├─ 1. Deduplicacao ──── Redis KV com TTL de 1h
  ├─ 2. Classificacao ─── Identifica 15+ tipos de mensagem
  ├─ 3. Buffer ────────── Janela deslizante (3s default, adaptativo)
  ├─ 4. Midia ─────────── Download → Upload R2 → STT para audio
  ├─ 5. Enriquecimento ── Nome do perfil, contexto do tenant, normalizacao de telefone
  ├─ 6. Presenca ──────── Envia indicador "digitando..." ao remetente
  └─ 7. Encaminhamento ── POST para webhooks com assinatura HMAC-SHA256
```

### Pipeline de Mensagens Enviadas (API)

```
Requisicao da API (POST /v1/instances/:id/messages)
  │
  ├─ 1. Validacao ─────────── Verificacao de campos obrigatorios
  ├─ 2. Verificacao ────────── Normalizacao E.164 + validacao do telefone
  ├─ 3. Anti-Spam ──────────── 30 msgs/min por destinatario (Redis atomico)
  ├─ 4. Preparacao de Midia ── Validacao de URL + limite de 50MB/min
  └─ ✓ Enfileirado no BullMQ → Worker entrega via Baileys
```

---

## Referencia da API

> Documentacao interativa completa disponivel em **`/v1/api/docs`** (Swagger UI)

### Autenticacao

Todas as requisicoes exigem um Bearer token:

```
Authorization: Bearer nc_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

As API keys suportam tres niveis de escopo:

| Escopo | Acesso |
|---|---|
| `read` | Leitura de instancias, mensagens, grupos, metricas |
| `send` | Envio de mensagens, reacoes, gerenciamento de presenca |
| `admin` | Acesso total — criar/deletar instancias, gerenciar webhooks e API keys |

### Rate Limiting

Limites aplicados em tres niveis, escalando conforme o plano do tenant:

| Nivel | FREE | STARTER | PRO | ENTERPRISE |
|---|---|---|---|---|
| Requisicoes API/min | 100 | 500 | 2.000 | 10.000 |
| Requisicoes por instancia/min | 100 | 100 | 100 | 100 |
| Por destinatario/min | 10 | 10 | 10 | 10 |

Headers de resposta: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Planos

| Recurso | FREE | STARTER | PRO | ENTERPRISE |
|---|---|---|---|---|
| Max instancias | 2 | 10 | 50 | Ilimitado |
| Mensagens/dia | 1.000 | 10.000 | 100.000 | Ilimitado |
| Broadcasts/dia | 1 | 10 | 100 | Ilimitado |

### Endpoints Principais

#### Instancias

| Metodo | Endpoint | Descricao |
|---|---|---|
| `POST` | `/v1/instances` | Criar nova instancia WhatsApp |
| `GET` | `/v1/instances` | Listar todas as instancias |
| `GET` | `/v1/instances/:id` | Detalhes da instancia |
| `PATCH` | `/v1/instances/:id` | Atualizar configuracoes |
| `DELETE` | `/v1/instances/:id` | Deletar instancia e todos os dados |
| `GET` | `/v1/instances/:id/qrcode` | Obter QR Code para autenticacao |
| `POST` | `/v1/instances/:id/pairing-code` | Solicitar codigo de pareamento |
| `POST` | `/v1/instances/:id/power-on` | Iniciar conexao WhatsApp |
| `POST` | `/v1/instances/:id/power-off` | Desconectar sessao |
| `POST` | `/v1/instances/:id/restart` | Reiniciar conexao |
| `PATCH` | `/v1/instances/:id/profile` | Atualizar perfil WhatsApp |
| `GET` | `/v1/instances/:id/health` | Saude e conectividade da instancia |
| `GET` | `/v1/instances/:id/metrics` | Metricas de volume e performance |

#### Mensagens

| Metodo | Endpoint | Descricao |
|---|---|---|
| `POST` | `/v1/instances/:id/messages` | Enviar mensagem (texto, imagem, video, audio, documento, localizacao, vcard) |
| `GET` | `/v1/instances/:id/messages` | Listar mensagens com paginacao e filtros |
| `GET` | `/v1/instances/:id/messages/:msgId` | Detalhes da mensagem |
| `POST` | `/v1/instances/:id/messages/:msgId/react` | Reagir a uma mensagem |

#### Webhooks

| Metodo | Endpoint | Descricao |
|---|---|---|
| `POST` | `/v1/instances/:id/webhooks` | Registrar endpoint de webhook |
| `PATCH` | `/v1/instances/:id/webhooks/:wid` | Atualizar configuracao do webhook |
| `DELETE` | `/v1/instances/:id/webhooks/:wid` | Remover webhook |
| `POST` | `/v1/instances/:id/webhooks/:wid/test` | Enviar payload de teste |
| `POST` | `/v1/events/replay` | Reprocessar eventos historicos |

#### Grupos

| Metodo | Endpoint | Descricao |
|---|---|---|
| `POST` | `/v1/instances/:id/groups` | Criar grupo WhatsApp |
| `GET` | `/v1/instances/:id/groups` | Listar todos os grupos |
| `GET` | `/v1/instances/:id/groups/:gid` | Detalhes do grupo |
| `PATCH` | `/v1/instances/:id/groups/:gid` | Atualizar informacoes do grupo |
| `DELETE` | `/v1/instances/:id/groups/:gid` | Sair do grupo |
| `POST` | `/v1/instances/:id/groups/:gid/participants` | Adicionar participantes |
| `DELETE` | `/v1/instances/:id/groups/:gid/participants` | Remover participantes |

#### Broadcasts

| Metodo | Endpoint | Descricao |
|---|---|---|
| `POST` | `/v1/broadcasts` | Criar campanha de broadcast |
| `GET` | `/v1/broadcasts` | Listar campanhas com paginacao |
| `GET` | `/v1/broadcasts/:id` | Detalhes e progresso da campanha |
| `PATCH` | `/v1/broadcasts/:id` | Pausar / retomar campanha |

Recursos de broadcast:
- **Balanceamento multi-instancia** — round-robin, baseado em saude ou aleatorio
- **Testes A/B** — variantes com pesos e distribuicao automatica
- **Delay configuravel** — entre mensagens para evitar rate limits

#### Agendamento

| Metodo | Endpoint | Descricao |
|---|---|---|
| `POST` | `/v1/scheduled-messages` | Agendar mensagem para envio futuro |
| `GET` | `/v1/scheduled-messages` | Listar mensagens agendadas |
| `DELETE` | `/v1/scheduled-messages/:id` | Cancelar mensagem agendada |
| `POST` | `/v1/cron-jobs` | Criar mensagem recorrente (expressao cron) |
| `GET` | `/v1/cron-jobs` | Listar cron jobs |
| `DELETE` | `/v1/cron-jobs/:id` | Desativar cron job |

#### Saude e Metricas

| Metodo | Endpoint | Descricao |
|---|---|---|
| `GET` | `/v1/health` | Saude do servico (banco + Redis) |
| `GET` | `/v1/health/live` | Probe de liveness (K8s) |
| `GET` | `/v1/health/ready` | Probe de readiness (K8s) |
| `GET` | `/v1/metrics` | Metricas Prometheus |

---

## Webhooks

### Entrega de Eventos

Todos os payloads incluem assinaturas criptograficas para verificacao:

```
X-NexConnect-Signature: sha256=<hmac_hex>
X-NexConnect-Event: message.received
X-NexConnect-Delivery-Id: <ulid>
X-NexConnect-Timestamp: <unix_timestamp>
```

### Exemplo de Verificacao

```typescript
import crypto from 'crypto';

function verificarWebhook(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return `sha256=${expected}` === signature;
}
```

### Tipos de Eventos (19)

| Categoria | Eventos |
|---|---|
| **Instancia** | `instance.connected`, `instance.disconnected`, `instance.qrcode`, `instance.mentioned`, `instance.health_warning` |
| **Mensagem** | `message.received`, `message.sent`, `message.delivered`, `message.read`, `message.deleted`, `message.reaction`, `message.pinned`, `message.unpinned` |
| **Grupo** | `group.created`, `group.updated`, `group.participants_added`, `group.participants_removed`, `group.participants_promoted`, `group.participants_demoted` |

### Politica de Retry

Backoff exponencial com base configuravel (padrao: 2.5x):

| Tentativa | Delay | Acumulado |
|---|---|---|
| 1a | ~2.5s | 2.5s |
| 2a | ~6.3s | 8.8s |
| 3a | ~15.6s | 24.4s |
| 4a | ~39s | 63.4s |
| 5a | ~97s | 160.4s |

Apos todas as tentativas falharem, os eventos vao para status **dead letter**. Use o endpoint de replay para re-entregar.

---

## Seguranca

### Protecao Multi-Camada

```
Requisicao → IP Allowlist → API Key Auth → Verificacao de Escopo → Rate Limit → Isolamento de Tenant
```

| Camada | Implementacao |
|---|---|
| **Autenticacao** | API keys com hash bcrypt + lookup O(1) por prefix + cache Redis 5min |
| **Autorizacao** | Controle de acesso baseado em escopos (`read`, `send`, `admin`) |
| **Isolamento de Tenant** | Row-Level Security no PostgreSQL + filtro na camada de aplicacao |
| **Rate Limiting** | Scripts Lua atomicos no Redis (sem race conditions) |
| **IP Allowlist** | Suporte a notacao CIDR por tenant |
| **Secrets de Webhook** | Criptografados com AES-256-GCM em repouso |
| **Estado de Autenticacao** | Dados de sessao Baileys criptografados com AES-256-GCM |
| **Redacao de PII** | Compliance LGPD automatico em logs (CPF, CNPJ, telefone, email, cartao de credito) |
| **Limite de Body** | 10MB padrao, 50MB para rotas de upload de midia |
| **Trilha de Auditoria** | Logs de auditoria imutaveis por tenant |

### Protecao de Saude do Numero

Scores calculados em escala de 0-100 com fatores ponderados:

| Fator | Peso | Descricao |
|---|---|---|
| Taxa de resposta | 30% | Razao mensagens recebidas/enviadas |
| Taxa de leitura | 20% | Percentual de mensagens lidas |
| Taxa de bounce | 20% | Percentual de entregas falhadas |
| Idade da instancia | 15% | Maturidade da conta (normalizada em 90 dias) |
| Razao de volume | 15% | Volume diario vs. threshold ideal |

**Acoes automaticas de throttling:**

| Score | Nota | Acao | Multiplicador de Delay |
|---|---|---|---|
| 81-100 | A | Operacao normal | 1.0x |
| 60-80 | B-C | Throttling leve | 1.2x |
| 40-59 | D | Throttling forte | 2.0x |
| 0-39 | F | Pausa de mensagens proativas | Pausado |

### Curva de Warm-up

Instancias novas seguem uma curva automatica de aquecimento:

| Dias | Limite Diario | Fase |
|---|---|---|
| 1-3 | 10 mensagens | Seed |
| 4-7 | 50 mensagens | Crescimento |
| 8-14 | 200 mensagens | Estabelecimento |
| 15-30 | 1.000 mensagens | Escala |
| 30+ | Limite do plano | Operacao plena |

---

## Observabilidade

### Logging

- **Motor:** Pino (JSON estruturado)
- **Correlacao:** Cada requisicao recebe um ULID via header `X-Correlation-ID`, propagado por `AsyncLocalStorage`
- **Redacao de PII:** Compliance LGPD automatico — CPF, CNPJ, telefone, email e cartao de credito redatados antes de logar
- **Propagacao de Contexto:** Servico `RequestLogger` com injecao automatica de tenantId/instanceId
- **Tracing de Metodos:** Decorator `@LogContext()` para logging automatico de inicio/sucesso/erro com duracao

### Tracing Distribuido

- **Protocolo:** OpenTelemetry (exportador OTLP)
- **Spans:** Requisicoes HTTP, jobs BullMQ, queries Prisma
- **Propagacao:** Contexto de trace flui de API → Fila → Worker
- **Configuracao:** Variavel de ambiente `OTEL_EXPORTER_OTLP_ENDPOINT`

### Metricas (Prometheus)

- `http_requests_total` — Contador por metodo, path e status
- `http_request_duration_seconds` — Histograma por metodo e path
- Metricas de negocio customizadas por instancia

### Health Probes

| Endpoint | Proposito | Probe K8s |
|---|---|---|
| `GET /v1/health` | Health check completo (DB + Redis) | — |
| `GET /v1/health/live` | Processo esta vivo | Liveness |
| `GET /v1/health/ready` | Dependencias acessiveis | Readiness |

---

## Resiliencia

### Circuit Breaker

Circuit breaker integrado para chamadas externas com tres estados:

| Estado | Comportamento |
|---|---|
| **CLOSED** | Operacao normal, conta falhas |
| **OPEN** | Rejeita imediatamente, espera timeout de reset (30s) |
| **HALF_OPEN** | Permite tentativas limitadas para testar recuperacao |

Configuravel: threshold de falhas, timeout de reset, maximo de tentativas em half-open.

### Graceful Shutdown

- Para de aceitar novas requisicoes ao receber SIGTERM/SIGINT
- Drena requisicoes em andamento (timeout de 30s)
- Fecha conexoes de banco e Redis de forma limpa
- Compativel com rolling updates do Kubernetes

### Retencao de Dados e Compliance LGPD

| Servico | Capacidade |
|---|---|
| `DataRetentionService` | Purga mensagens, entregas e logs de auditoria expirados |
| `DataExportService` | Exportacao completa de dados do tenant (LGPD Art. 18, V) |
| `eraseTenantPii()` | Direito ao esquecimento — hard delete de toda PII (LGPD Art. 18, VI) |

---

## Testes

### Infraestrutura de Testes

| Ferramenta | Proposito |
|---|---|
| **Vitest** | Testes unitarios e de integracao |
| **Supertest** | Testes de endpoints HTTP |
| **Testcontainers** | PostgreSQL + Redis em Docker para testes de integracao |
| **Pact** | Testes de contrato entre servicos |

### Executando Testes

```bash
pnpm test             # Testes unitarios
pnpm test:cov         # Com relatorio de cobertura (HTML + JSON)
pnpm test:e2e         # Testes end-to-end (requer Docker)
```

### Thresholds de Cobertura

| Metrica | Threshold |
|---|---|
| Linhas | 80% |
| Funcoes | 80% |
| Branches | 75% |
| Statements | 80% |

### Cobertura de Testes

- **44 arquivos de teste** cobrindo guards, interceptors, filters, pipes, services, pipeline stages, utilitarios, SDK e testes de contrato
- **100% de cobertura** em: guards, filters, pipes, pipeline stages de saida
- Testes de integracao com containers reais de PostgreSQL e Redis
- Testes de contrato validando estrutura de payload dos webhooks

---

## Deploy

### Kubernetes

O NexConnect vem com manifests Kustomize prontos para producao em `infra/k8s/`:

```bash
kubectl apply -k infra/k8s/
```

**Namespace:** `nexconnect`

#### Deploy da API
- 2 replicas com rolling updates
- Recursos: 250m-1 CPU, 512Mi-1Gi de memoria
- Health probes: liveness, readiness, startup

#### Deploy do Worker
- HPA: 2-50 replicas
- Metrica de escala: `active_instances` (alvo: 25 por pod)
- Alvo de memoria: 75% de utilizacao
- Scale-up: 5 pods/60s, scale-down: 2 pods/120s

### Docker

Dockerfiles multi-stage para imagens de producao minimas:

```bash
# Build das imagens
docker build -t nexconnect-api -f apps/api/Dockerfile .
docker build -t nexconnect-worker -f apps/worker/Dockerfile .
```

### CI/CD (GitHub Actions)

Pipeline: **Lint → Test → Build → Docker Build**

- Containers de servico PostgreSQL 16 + Redis 7 para testes
- Geracao de Prisma client e migracoes
- Upload de artefato de cobertura
- Imagens Docker construidas em push para branch main

---

## Variaveis de Ambiente

<details>
<summary>Clique para expandir a referencia completa de configuracao</summary>

```bash
# ─── Banco de Dados ─────────────────────────────────────
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

# ─── Autenticacao ────────────────────────────────────────
API_KEY_HASH_ROUNDS=12
JWT_SECRET="altere-em-producao"
JWT_EXPIRES_IN="1h"

# ─── Comunicacao Inter-Pod (RS256) ──────────────────────
INTER_POD_PRIVATE_KEY=""
INTER_POD_PUBLIC_KEY=""

# ─── Cloudflare R2 (S3-compativel) ─────────────────────
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

# ─── Entrega de Webhooks ───────────────────────────────
WEBHOOK_RETRY_MAX_ATTEMPTS=5
WEBHOOK_RETRY_BACKOFF_BASE=2.5

# ─── Criptografia ──────────────────────────────────────
ENCRYPTION_KEY="sua-chave-hex-de-32-bytes-aqui"

# ─── Observabilidade ───────────────────────────────────
OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
LOG_LEVEL="info"                # debug | info | warn | error

# ─── Integracao NexBot ─────────────────────────────────
NEXBOT_WEBHOOK_URL=""
NEXBOT_CHANNEL_SECRET=""
```

</details>

---

## Registros de Decisao Arquitetural

| ADR | Decisao |
|---|---|
| [ADR-001](docs/adr/ADR-001-baileys-websocket-engine.md) | Baileys como engine WebSocket do WhatsApp |
| [ADR-002](docs/adr/ADR-002-postgresql-session-persistence.md) | PostgreSQL para persistencia de sessao |
| [ADR-003](docs/adr/ADR-003-max-30-instances-per-pod.md) | Maximo de 30 instancias por worker pod |
| [ADR-004](docs/adr/ADR-004-bullmq-message-queues.md) | BullMQ para processamento distribuido de jobs |
| [ADR-005](docs/adr/ADR-005-ulid-for-event-ids.md) | ULID para identificadores de eventos |
| [ADR-006](docs/adr/ADR-006-stt-in-nexconnect.md) | Processamento STT dentro do NexConnect |
| [ADR-007](docs/adr/ADR-007-ocr-tts-outside-nexconnect.md) | OCR/TTS fora da fronteira do NexConnect |
| [ADR-008](docs/adr/ADR-008-srp-refactoring.md) | Refatoracao de responsabilidade de servicos |
| [ADR-009](docs/adr/ADR-009-atomic-rate-limiting.md) | Rate limiting atomico com scripts Lua |
| [ADR-010](docs/adr/ADR-010-provider-abstraction.md) | Abstracao de providers para Meta (WhatsApp Cloud, Instagram, Messenger) e Twilio (SMS, WhatsApp, Voice, Verify) |

---

## Provedores Oficiais: Meta + Twilio

Alem do engine Baileys padrao, o NexConnect integra os provedores oficiais:

### Meta Graph API (v21.0)

- **WhatsApp Business Cloud API** — envio completo (texto, imagem, video, audio, documento, sticker, localizacao, contatos, template, interactive buttons, interactive list, reaction), marcar como lido, indicador de digitacao, upload/download de midia e gerenciamento de templates.
- **Instagram Messaging API** — DMs com texto, midia, quick replies, mark seen e typing indicator.
- **Facebook Messenger Platform** — mensagens com texto, attachments, quick replies.
- **Webhooks** — endpoint unico `/v1/webhooks/meta` com verificacao do `hub.challenge` e validacao obrigatoria de `X-Hub-Signature-256`.

### Twilio

- **Messages API** — SMS, MMS, WhatsApp via Twilio (canal unificado com prefixo `whatsapp:`).
- **Voice API** — chamadas de saida com TwiML, status callbacks para cada evento (`initiated`, `ringing`, `answered`, `completed`), machine detection e gravacao.
- **Verify API** — OTP via SMS, voz, email ou WhatsApp com `verifyServiceSid`.
- **Webhooks** — `/v1/webhooks/twilio/messages/inbound`, `/messages/status`, `/voice/status`, todos com validacao de `X-Twilio-Signature` (form e JSON com `bodySHA256`).

### Arquitetura de Providers

```text
libs/core/src/providers/
  IMessagingProvider            # Contrato unico (send, markAsRead, typing, media)
  OutboundMessage               # Uniao discriminada normalizada
  InboundMessage                # Modelo normalizado para mensagens recebidas
  ProviderCapability            # Flags de recursos por provider
  ProviderError                 # Hierarquia de erros tipados

libs/shared/src/
  http/HttpClient               # Retry + backoff + circuit breaker
  signature/MetaSignatureValidator
  signature/TwilioSignatureValidator

apps/api/src/modules/
  providers/                    # Registry + dispatcher + credentials CRUD
  meta/                         # WhatsApp Cloud, Instagram, Messenger + webhooks
  twilio/                       # Messaging (SMS/WA), Voice, Verify + webhooks
```

Credenciais por tenant sao criptografadas com AES-256-GCM (`ENCRYPTION_KEY`) e armazenadas em `provider_credentials`. Identificadores publicos (`accountSid`, `phoneNumberId`, `pageId`) ficam em colunas nao-encriptadas para resolver webhooks sem precisar descriptografar.

Para registrar credenciais:

```bash
POST /v1/providers/credentials
Authorization: Bearer nc_sua_api_key_admin
Content-Type: application/json

{
  "provider": "META_WHATSAPP_CLOUD",
  "displayName": "WABA Production",
  "instanceId": "uuid-da-instance",
  "credentials": {
    "businessAccountId": "123456789",
    "phoneNumberId": "987654321",
    "accessToken": "EAAx...",
    "appSecret": "xxxxx",
    "webhookVerifyToken": "my-verify-token"
  }
}
```

---

## SDK e CLI

### SDK TypeScript

```bash
npm install @nexconnect/sdk
```

```typescript
import { NexConnect } from '@nexconnect/sdk';

const client = new NexConnect({
  apiKey: 'nc_sua_api_key_aqui',
  baseUrl: 'https://api.nexconnect.io/v1',
});

// Enviar uma mensagem
await client.messages.send('instance-id', {
  to: '5511999999999',
  type: 'text',
  content: { text: 'Ola do NexConnect!' },
});

// Listar instancias
const { data, meta } = await client.instances.list({ page: 1, limit: 10 });
```

### Ferramenta CLI

```bash
npx @nexconnect/cli instances list
npx @nexconnect/cli messages send --instance <id> --to 5511999999999 --text "Ola"
```

---

## Contribuindo

Repositorio privado. Para contribuidores internos:

1. Crie uma feature branch a partir de `develop`
2. Siga as convencoes de codigo existentes (ESLint + Prettier aplicados)
3. Adicione testes para novas funcionalidades
4. Garanta que `pnpm lint && pnpm test` passa
5. Crie um PR direcionado para `develop`

---

<p align="center">
  <sub>Construido com precisao por <strong>Orbitmind</strong></sub>
</p>

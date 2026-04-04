# NexConnect — WhatsApp Engine

> Microserviço enterprise de **transporte puro** responsável por toda a camada de comunicação WhatsApp do ecossistema NexBot.

**Status:** Em desenvolvimento
**Versão:** 1.0.0
**Classificação:** CONFIDENCIAL — Orbitmind

---

## O que e o NexConnect

O NexConnect recebe mensagens do WhatsApp, normaliza em payload padronizado e entrega ao NexBot — e entrega respostas do NexBot de volta ao WhatsApp. Sem IA, sem LLM, sem OCR. Transporte puro + STT (transcrição de áudio como normalização).

### Fronteiras de Responsabilidade

| Responsabilidade | NexConnect | NexBot | Vektus |
|---|---|---|---|
| Conexão WebSocket WhatsApp (Baileys) | Sim | - | - |
| Buffer / dedup / classificação | Sim | - | - |
| Download de mídia -> upload R2 | Sim | - | - |
| STT — transcrição de áudio recebido | Sim | - | - |
| Session persistence / health score | Sim | - | - |
| HMAC / segurança de webhook | Sim | - | - |
| OCR de imagens | - | - | Sim |
| TTS (geração de .ogg) | - | Sim | - |
| Inferência LLM | - | Sim | - |
| RAG / Knowledge Base | - | - | Sim |

---

## Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| Runtime | Node.js + TypeScript | 22 LTS / 5.x |
| Framework | NestJS + Fastify | 11.x |
| WhatsApp | @WhiskeySockets/Baileys | latest |
| ORM | Prisma | 6.x |
| Cache / PubSub | Redis | 7.x |
| Filas | BullMQ | 5.x |
| Storage | Cloudflare R2 | - |
| STT | OpenAI Whisper API | - |
| Observabilidade | OpenTelemetry + Prometheus + Grafana | - |
| Logging | Pino | 9.x |
| Testes | Vitest + Supertest + Testcontainers | - |

---

## Arquitetura

```
nexconnect/
├── apps/
│   ├── api/          # API Gateway (REST)
│   └── worker/       # Worker pods (Baileys + Pipeline)
├── libs/
│   ├── core/         # Entidades, interfaces, DTOs, enums
│   ├── database/     # Prisma schema, migrations, PrismaService
│   ├── redis/        # Redis client, pub/sub, cache
│   └── shared/       # Utils, constants, exceptions
├── prisma/           # Schema e migrations
├── docs/             # PRD e documentação
└── scripts/          # Scripts utilitários
```

### 6 Camadas

| Camada | Responsabilidade |
|---|---|
| API Layer | Recebe chamadas REST dos consumidores |
| Instance Manager | CRUD de instâncias, lifecycle, settings, health |
| Connection Pool | Gerencia conexões Baileys por pods |
| Message Processor | Pipeline: dedup -> classify -> buffer -> media -> enrich -> forward |
| Media Processor | Download, upload R2, STT, compressão |
| Webhook Dispatcher | Entrega eventos, retry, HMAC, replay |

### Pipeline de Mensagens Recebidas

```
Baileys Event
  -> 1. Deduplication (Redis KV, TTL 1h)
  -> 2. Classification (identifica tipo entre 15 tipos)
  -> 3. Buffer (sliding window texto, 3000ms default)
  -> 4. Media Processing (download + R2 + STT para áudio)
  -> 5. Enrichment (metadados: profile, tenant, phone)
  -> 6. Presence (envia "digitando..." ao remetente)
  -> 7. Forward (POST webhook com HMAC-SHA256)
```

---

## Setup Local

### Pré-requisitos

- Node.js >= 22
- pnpm >= 9
- Docker + Docker Compose

### Instalação

```bash
# Clone o repositório
git clone <repo-url> nexconnect
cd nexconnect

# Instale dependências
pnpm install

# Copie variáveis de ambiente
cp .env.example .env

# Suba infra local (PostgreSQL + Redis)
docker compose up -d postgres redis

# Gere o Prisma Client
pnpm db:generate

# Execute migrations
pnpm db:migrate

# Inicie em desenvolvimento
pnpm dev:api     # API na porta 3100
pnpm dev:worker  # Worker
```

### Docker Compose (tudo junto)

```bash
docker compose up -d
```

---

## API Endpoints

### Instâncias

| Método | Endpoint | Descrição |
|---|---|---|
| GET | /v1/instances | Listar instâncias |
| POST | /v1/instances | Criar instância |
| GET | /v1/instances/:id | Detalhes da instância |
| PATCH | /v1/instances/:id | Atualizar settings |
| DELETE | /v1/instances/:id | Excluir instância |
| GET | /v1/instances/:id/qrcode | Obter QR Code |
| POST | /v1/instances/:id/pairing-code | Código de pareamento |
| POST | /v1/instances/:id/power-on | Ligar instância |
| POST | /v1/instances/:id/power-off | Desligar instância |
| POST | /v1/instances/:id/restart | Reiniciar |
| GET | /v1/instances/:id/health | Health check |
| GET | /v1/instances/:id/metrics | Métricas |

### Mensagens

| Método | Endpoint | Descrição |
|---|---|---|
| POST | /v1/instances/:id/messages | Enviar mensagem |
| GET | /v1/instances/:id/messages | Listar mensagens |
| GET | /v1/instances/:id/messages/:msgId | Detalhes da mensagem |

### Webhooks

| Método | Endpoint | Descrição |
|---|---|---|
| POST | /v1/instances/:id/webhooks | Criar webhook |
| PATCH | /v1/instances/:id/webhooks/:wid | Atualizar |
| DELETE | /v1/instances/:id/webhooks/:wid | Excluir |
| POST | /v1/instances/:id/webhooks/:wid/test | Testar |
| POST | /v1/events/replay | Replay de eventos |

### Grupos

| Método | Endpoint | Descrição |
|---|---|---|
| GET | /v1/instances/:id/groups | Listar grupos |
| POST | /v1/instances/:id/groups | Criar grupo |
| GET | /v1/instances/:id/groups/:gid | Detalhes |
| PATCH | /v1/instances/:id/groups/:gid | Atualizar |
| DELETE | /v1/instances/:id/groups/:gid | Sair |
| POST | /v1/instances/:id/groups/:gid/participants | Adicionar |
| DELETE | /v1/instances/:id/groups/:gid/participants | Remover |
| POST | /v1/instances/:id/groups/join | Entrar via link |

### Utilitários

| Método | Endpoint | Descrição |
|---|---|---|
| GET | /v1/instances/:id/recipients/:number | Verificar número |
| POST | /v1/instances/:id/recipients/batch | Verificação em lote |
| PATCH | /v1/instances/:id/presence | Presence update |

### Agendamento

| Método | Endpoint | Descrição |
|---|---|---|
| POST | /v1/instances/:id/scheduled-messages | Agendar |
| GET | /v1/instances/:id/scheduled-messages | Listar |
| DELETE | /v1/instances/:id/scheduled-messages/:sid | Cancelar |

### Broadcasts

| Método | Endpoint | Descrição |
|---|---|---|
| POST | /v1/broadcasts | Enviar broadcast com pool rotation |

---

## Autenticação

Todas as requisições usam API Key no header Authorization:

```
Authorization: Bearer nc_xxxxxxxxxxxxxxxxxxxxx
```

### Scopes

- `read` — leitura de dados
- `send` — envio de mensagens
- `admin` — operações administrativas

---

## Webhooks

### Segurança HMAC-SHA256

Todos os webhooks incluem assinatura no header:

```
X-NexConnect-Signature: sha256=<hmac_hex>
X-NexConnect-Event: message.received
X-NexConnect-Delivery-Id: <uuid>
X-NexConnect-Timestamp: <unix_timestamp>
```

### Verificação (Node.js)

```typescript
import crypto from 'crypto';

const expectedSig = crypto
  .createHmac('sha256', webhookSecret)
  .update(rawBody)
  .digest('hex');

const isValid = `sha256=${expectedSig}` === req.headers['x-nexconnect-signature'];
```

### Eventos (18 tipos)

**Instância:** instance.connected, instance.disconnected, instance.qrcode, instance.mentioned

**Mensagem:** message.received, message.sent, message.delivered, message.read, message.deleted, message.reaction, message.pinned, message.unpinned

**Grupo:** group.created, group.updated, group.participants_added, group.participants_removed, group.participants_promoted, group.participants_demoted

### Retry Policy

| Tentativa | Intervalo |
|---|---|
| 1a | ~2.5s |
| 2a | ~6s |
| 3a | ~15s |
| 4a | ~39s |
| 5a | ~97s |

Após 5 falhas -> dead_letter (replay manual disponível).

---

## Proteção de Número

### Health Score (0-100)

| Componente | Peso |
|---|---|
| Taxa de resposta | 30% |
| Taxa de leitura | 20% |
| Taxa de bounces | 20% |
| Idade da instância | 15% |
| Volume relativo | 15% |

### Ações Automáticas

- **> 80:** operação normal
- **60-80:** throttling leve (+20% delay)
- **40-60:** throttling forte (-50% volume)
- **< 40:** pausa de proativos

### Warm-up Automático

| Dia | Limite |
|---|---|
| 1-3 | 10 msgs/dia |
| 4-7 | 50 msgs/dia |
| 8-14 | 200 msgs/dia |
| 15-30 | 1.000 msgs/dia |
| 30+ | Configurado |

---

## Segurança

- API Keys com hash bcrypt (nc_ prefix)
- Auth state Baileys: AES-256-GCM em repouso
- Webhook secrets: criptografados AES-256
- URLs de mídia R2: assinadas com TTL
- PII redaction automático em logs (LGPD)
- Audit trail imutável
- Rate limiting multinível

---

## Testes

```bash
# Testes unitários
pnpm test

# Testes com cobertura
pnpm test:cov

# Testes e2e
pnpm test:e2e
```

### Cobertura Mínima

| Nível | Target |
|---|---|
| Unit | 90% |
| Integration | 70% |
| E2E | 50% |

---

## Variáveis de Ambiente

Veja `.env.example` para a lista completa de variáveis.

---

## Licença

UNLICENSED — Propriedade exclusiva Orbitmind.

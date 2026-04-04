# NexConnect — WhatsApp Engine
## Product Requirements Document

> **Versão:** 1.1
> **Data:** Março 2026
> **Status:** Confidencial — Orbitmind
> **Autor:** Wesley Lima — Orbitmind
> **Classificação:** CONFIDENCIAL — Uso Interno Orbitmind
>
> **Pilares:** Enterprise Grade · Clean Code · SOLID/SRP
>
> **v1.1 — Correção arquitetural:** OCR, TTS, RAG e Vision LLM removidos do escopo. O NexConnect é transporte puro. STT mantido pois é normalização de mensagem antes do forward (transforma mídia em payload consumível pelo NexBot). Toda IA fica no NexBot via Vercel AI Gateway. Todo RAG/OCR de documentos fica no Vektus.

---

## Sumário

1. [Visão Geral do Produto](#1-visão-geral-do-produto)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Módulos Funcionais](#3-módulos-funcionais)
4. [Sistema de Webhooks e Eventos](#4-sistema-de-webhooks-e-eventos)
5. [Módulo de Grupos](#5-módulo-de-grupos)
6. [Módulo de Utilitários](#6-módulo-de-utilitários)
7. [Proteção de Número e Saúde da Conta](#7-proteção-de-número-e-saúde-da-conta)
8. [Segurança e Compliance](#8-segurança-e-compliance)
9. [Observabilidade e Monitoramento](#9-observabilidade-e-monitoramento)
10. [Developer Experience (DX)](#10-developer-experience-dx)
11. [Multi-tenancy e Isolamento](#11-multi-tenancy-e-isolamento)
12. [Features Avançadas e Diferenciais](#12-features-avançadas-e-diferenciais)
13. [Modelo de Dados](#13-modelo-de-dados)
14. [Estrutura de Código e Padrões](#14-estrutura-de-código-e-padrões)
15. [Roadmap de Implementação](#15-roadmap-de-implementação)
16. [Estratégia de Testes](#16-estratégia-de-testes)
17. [Integração com o NexBot](#17-integração-com-o-nexbot)
18. [Decisões Técnicas e ADRs](#18-decisões-técnicas-e-adrs)
19. [Glossário](#19-glossário)
20. [Histórico de Versões](#20-histórico-de-versões)

---

## 1. Visão Geral do Produto

### 1.1 O que é o NexConnect

O NexConnect é um microserviço enterprise de **transporte puro** responsável por toda a camada de comunicação WhatsApp do ecossistema NexBot. Sua missão é uma e apenas uma: **receber mensagens do WhatsApp, normalizá-las em um payload padronizado e entregá-las ao NexBot — e entregar respostas do NexBot de volta ao WhatsApp.**

O NexConnect não tem inteligência artificial, não faz inferência de LLM, não processa OCR de documentos e não gera áudio TTS. Toda a inteligência fica no NexBot (via Vercel AI Gateway) e no Vektus (RAG/OCR de Knowledge Base). O NexConnect é o canal — não o cérebro.

A única exceção arquitetural é o **STT (transcrição de áudio)**: quando o usuário envia um áudio no WhatsApp, o NexConnect o transcreve via Whisper antes do forward. Isso é justificado pelo princípio de normalização — o NexBot deve sempre receber um payload pronto para inferência. Entregar áudio bruto ao NexBot quebraria esse contrato, pois o NexBot precisaria saber sobre formatos de áudio do Baileys, URLs de mídia temporárias e timing de processamento — responsabilidades de transporte, não de lógica de negócio.

### 1.2 Posicionamento Estratégico

> 🎯 **Proposta de Valor Central:** O NexConnect elimina a dependência de terceiros não-oficiais, reduz custo de R$ 47–80/instância/mês para custo marginal de infra, e entrega um ativo proprietário que pode ser licenciado como produto standalone.

O NexConnect resolve três problemas críticos de escala:

- **Dependência de terceiros** — instabilidade de providers externos afeta 100% dos clientes NexBot
- **Custo variável alto** — R$ 47–80 por instância/mês torna inviável o modelo de negócio em escala
- **Funcionalidades limitadas** — buffers fixos, sem STT, sem observabilidade, sem proteção de número

### 1.3 Fronteiras de Responsabilidade (Arquitetura Definitiva)

| Responsabilidade | NexConnect | NexBot | Vektus |
|---|---|---|---|
| Conexão WebSocket WhatsApp (Baileys) | ✅ | ❌ | ❌ |
| Buffer / dedup / classificação | ✅ | ❌ | ❌ |
| Download de mídia → upload R2 | ✅ | ❌ | ❌ |
| STT — transcrição de áudio recebido | ✅ | ❌ | ❌ |
| Session persistence / health score / warm-up | ✅ | ❌ | ❌ |
| HMAC / segurança de webhook | ✅ | ❌ | ❌ |
| OCR de imagens | ❌ | ❌ | ✅ |
| RAG / busca semântica / Knowledge Base | ❌ | ❌ | ✅ |
| TTS (geração de .ogg de resposta) | ❌ | ✅ | ❌ |
| Vision LLM / análise de imagem | ❌ | ✅ | ❌ |
| Inferência LLM (qualquer) | ❌ | ✅ | ❌ |
| Agent Builder / Handoff / Analytics | ❌ | ✅ | ❌ |

### 1.4 Diferenciação vs Mercado

| Funcionalidade | Zapster | WaAPI / Green-API | NexConnect |
|---|---|---|---|
| Conexão WebSocket nativa | ✅ | ✅ | ✅ |
| STT (transcrição de áudio) | ❌ | ❌ | ✅ Whisper inline |
| Buffer adaptativo de texto | ❌ | ❌ | ✅ sliding window + ML |
| Proteção de número / warm-up | ❌ | ⚠️ básico | ✅ score + throttling |
| Isolamento multi-tenant | ⚠️ parcial | ❌ | ✅ namespace completo |
| Observabilidade / métricas | ⚠️ básico | ❌ | ✅ Grafana + traces |
| Webhook HMAC signature | ❌ | ❌ | ✅ SHA-256 |
| Session persistence robusta | ⚠️ parcial | ⚠️ parcial | ✅ PostgreSQL-backed |
| Auto-reconnect com backoff | ⚠️ parcial | ⚠️ parcial | ✅ circuit breaker |
| Agendamento avançado / cron | ⚠️ básico | ⚠️ básico | ✅ cron + smart time |
| Presence update (digitando...) | ✅ | ⚠️ parcial | ✅ until_next_message |
| Pod isolation horizontal | ❌ | ❌ | ✅ 30 inst/pod |
| WhatsApp Stories / Channels API | ❌ | ❌ | ✅ |
| SDK TypeScript oficial | ❌ | ❌ | ✅ |
| Sandbox environment | ❌ | ❌ | ✅ |
| LGPD compliance nativo | ❌ | ❌ | ✅ |

---

## 2. Arquitetura do Sistema

### 2.1 Princípios Arquiteturais

O NexConnect é construído sobre os seguintes princípios não-negociáveis:

- **Transporte puro** — nenhuma inferência de IA, nenhuma lógica de negócio, apenas normalização e entrega de mensagens
- **Clean Code** — nomenclatura expressiva, funções pequenas com responsabilidade única, zero magic numbers
- **SOLID** — Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- **SRP estrito** — cada classe/módulo tem exatamente uma razão para mudar
- **Fail-fast** — erros detectados e surfaced o mais cedo possível na pipeline
- **Observability-first** — toda operação produz logs estruturados, métricas e traces desde o dia 1
- **Security by default** — criptografia em repouso, HMAC em trânsito, audit trail completo
- **Horizontal scalability** — nenhum estado local em memória que impeça escala horizontal

### 2.2 Visão de Alto Nível — 6 Camadas

| Camada | Responsabilidade | Tecnologia Principal |
|---|---|---|
| API Layer | Recebe chamadas REST/WebSocket dos consumidores (NexBot, externos) | NestJS + Fastify |
| Instance Manager | CRUD de instâncias, lifecycle, settings, health | NestJS Service + PostgreSQL |
| Connection Pool | Gerencia conexões Baileys, distribuição por pods | Baileys + Redis Pub/Sub |
| Message Processor | Pipeline: dedup → classify → buffer → media → enrich → forward | NestJS + BullMQ |
| Media Processor | Download, upload R2, STT de áudio, compressão, conversão | NestJS + Whisper + R2 |
| Webhook Dispatcher | Entrega eventos, retry, HMAC, replay, event sourcing | BullMQ + PostgreSQL |

### 2.3 Arquitetura de Pods (300–1.000+ instâncias)

```
┌─────────────────────────────────────────────────────────────────┐
│                    NexConnect Cluster                           │
│                                                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐      │
│  │  Worker Pod 1 │  │  Worker Pod 2 │  │  Worker Pod N │      │
│  │  ~30 instâncias│  │  ~30 instâncias│  │  ~30 instâncias│    │
│  │  Baileys WS   │  │  Baileys WS   │  │  Baileys WS   │      │
│  │  Message Proc │  │  Message Proc │  │  Message Proc │      │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘      │
│          └──────────────────┼──────────────────┘               │
│                             ↕                                   │
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

Regras de distribuição:

- Máximo de 30 instâncias Baileys por Worker Pod (processo Node.js)
- Para 300 instâncias → 10 pods; para 1.000 → 34 pods; para 10.000 → 334 pods
- Cada pod é stateless — estado de sessão persiste no PostgreSQL, estado quente no Redis
- Se um pod cair, instâncias são redistribuídas automaticamente
- Auto-scaling baseado em instâncias ativas e latência de processamento

### 2.4 Stack Tecnológica

| Camada | Tecnologia | Versão | Justificativa |
|---|---|---|---|
| Runtime | Node.js + TypeScript | 22 LTS / 5.x | Mesmo ecossistema Baileys, performance I/O |
| Framework | NestJS + Fastify adapter | 11.x | DI nativo, JSON logging, IntrinsicException, performance |
| WhatsApp Core | @WhiskeySockets/Baileys | latest | TypeScript nativo, WebSocket direto, sem browser |
| ORM | Prisma (Rust-free) | 6.x | TypedSQL, prisma.config.ts, Query Compiler, excelente DX |
| Cache / PubSub | Redis | 7.x | Estado quente de instâncias, dedup, pub/sub entre pods |
| Filas | BullMQ | 5.x | Priority queues, rate limiting nativo, delayed jobs |
| Storage de Mídia | Cloudflare R2 | — | Zero egress cost, URLs permanentes, CDN global |
| STT | OpenAI Whisper API (primary) + Workers AI (fallback) | — | Melhor accuracy pt-BR, fallback sem custo adicional |
| Observabilidade | OpenTelemetry + Prometheus + Grafana + Loki | 1.x | Stack padrão enterprise |
| Logging | Pino | 9.x | JSON estruturado, alta performance |
| Secrets | Infisical | — | Consistência com NexBot, multi-ambiente |
| Container | Docker + Kubernetes (k3s em dev) | — | Orquestração de pods, auto-scaling |
| CI/CD | GitHub Actions | — | Consistência com NexBot |
| Testes | Vitest + Supertest + Testcontainers | — | Unit, integration e e2e |

---

## 3. Módulos Funcionais

### 3.1 Módulo de Gestão de Instâncias

#### 3.1.1 Responsabilidade

Gerenciar o ciclo de vida completo de instâncias WhatsApp: criação, autenticação, configuração, monitoramento, power management e exclusão. Cada instância representa uma conexão única de um número de telefone ao WhatsApp.

#### 3.1.2 Endpoints REST

| Método | Endpoint | Descrição | Auth |
|---|---|---|---|
| GET | /v1/instances | Listar instâncias (paginado, filtros) | API Key |
| POST | /v1/instances | Criar nova instância | API Key |
| GET | /v1/instances/:id | Detalhes completos da instância | API Key |
| PATCH | /v1/instances/:id | Atualizar settings da instância | API Key |
| DELETE | /v1/instances/:id | Excluir instância e desconectar | API Key |
| GET | /v1/instances/:id/qrcode | Obter QR Code (base64 + SVG) | API Key |
| POST | /v1/instances/:id/pairing-code | Gerar código de pareamento (alternativa QR) | API Key |
| POST | /v1/instances/:id/power-on | Ligar instância (restaura sessão) | API Key |
| POST | /v1/instances/:id/power-off | Desligar instância (mantém sessão) | API Key |
| POST | /v1/instances/:id/restart | Reiniciar instância | API Key |
| PATCH | /v1/instances/:id/profile | Atualizar nome, foto de perfil, bio | API Key |
| GET | /v1/instances/:id/health | Health check detalhado da instância | API Key |
| GET | /v1/instances/:id/metrics | Métricas de uso da instância | API Key |
| POST | /v1/instances/:id/webhooks | Criar webhook na instância | API Key |
| PATCH | /v1/instances/:id/webhooks/:wid | Atualizar webhook | API Key |
| DELETE | /v1/instances/:id/webhooks/:wid | Excluir webhook | API Key |
| POST | /v1/instances/:id/webhooks/:wid/test | Disparar evento de teste no webhook | API Key |

#### 3.1.3 Settings de Instância

```typescript
interface InstanceSettings {
  // Comportamento de chamadas
  callRejection: 'all' | 'none' | 'unknown';

  // Delay humanizado de digitação (simula comportamento humano no envio)
  messageDelay: { enabled: boolean; minMs: number; maxMs: number; };
  delayPerWord: boolean;

  // Comportamento de presença
  presenceBehavior: 'only_composing' | 'always_online' | 'never';

  // Confirmações de leitura
  readConfirmation: 'always' | 'never' | 'contacts_only';

  // Proteção de número
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  allowedSendWindow: {
    enabled: boolean;
    startHour: number;
    endHour: number;
    timezone: string;
  };

  // Buffer de texto
  bufferEnabled: boolean;
  bufferWindowMs: number;       // default 3000ms
  bufferMaxMessages: number;    // flush forçado ao atingir limite
  bufferAdaptive: boolean;      // aprende padrão do usuário

  // STT — transcrição de áudio recebido
  sttEnabled: boolean;
  sttProvider: 'whisper' | 'assemblyai' | 'azure';
  sttLanguage: string;          // default 'pt-BR'

  // Presença automática (digitando...)
  autoPresence: {
    enabled: boolean;
    status: 'typing' | 'recording';
    strategy: 'maximum_duration' | 'until_next_message';
  };
}
```

#### 3.1.4 Tipos de Conexão

| Tipo | Método de Auth | Casos de Uso | Limitações |
|---|---|---|---|
| QR Code (Unofficial) | Scan via Baileys WebSocket | MVP, testes, volume baixo-médio | Risco de ban em alto volume |
| Pairing Code (Unofficial) | Código numérico 8 dígitos | Automação sem acesso à câmera | Mesmo risco QR Code |
| WABA (Official) | OAuth Embedded Signup ou token manual | Enterprise, alto volume, zero risco | Aprovação Meta, cobra por template |

---

### 3.2 Módulo de Pipeline de Mensagens Recebidas

#### 3.2.1 Responsabilidade (SRP)

Processar mensagens recebidas do WhatsApp através de uma pipeline determinística e observável. Cada estágio é uma classe independente com uma única responsabilidade.

#### 3.2.2 Estágios da Pipeline

| # | Estágio | Classe | Responsabilidade |
|---|---|---|---|
| 1 | Deduplication | `MessageDeduplicationService` | Verifica Redis KV por message_id + TTL 1h. Descarta duplicatas silenciosamente. |
| 2 | Classification | `MessageClassificationService` | Identifica o tipo de mensagem dentre 15 tipos suportados. |
| 3 | Buffer | `MessageBufferService` | Acumula mensagens de texto numa sliding window configurável. |
| 4 | Media | `MediaProcessingService` | Download binário → upload R2. Para áudio: executa STT. Para outros tipos: entrega URL. |
| 5 | Enrichment | `MessageEnrichmentService` | Adiciona metadados: contact profile, tenant_id, is_group, phone normalizado. |
| 6 | Presence | `PresenceUpdateService` | Envia "digitando..." automaticamente enquanto processa. |
| 7 | Forward | `WebhookDispatchService` | POST para webhooks configurados com retry exponencial e HMAC. |

> **Importante sobre a Media Stage:** O NexConnect **não faz OCR de imagens**. Para imagens, o estágio de mídia apenas baixa o arquivo e faz upload para R2, retornando a `media_url` no payload. O NexBot decide o que fazer com a imagem (chamar Vektus para OCR ou usar Vision LLM via AI Gateway).

#### 3.2.3 Tipos de Mensagem e Processamento

| Tipo | Processamento no NexConnect | O que chega ao NexBot |
|---|---|---|
| `text` | Buffer + detecção de continuação | `content.text` já bufferizado |
| `audio` | Download → R2 → **STT Whisper** → transcription | `content.transcription` + `content.media_url` |
| `image` | Download → R2 | `content.media_url` (NexBot decide OCR/Vision) |
| `video` | Download → R2 → thumbnail → duração | `content.media_url` + `content.thumbnail_url` |
| `document` | Download → R2 → filename normalizado | `content.media_url` + `content.filename` |
| `sticker` | Download → R2 → metadata animated | `content.media_url` + `content.animated` |
| `location` | Normalização lat/lng | `content.latitude` + `content.longitude` |
| `vcard` | Parse vCard → estrutura normalizada | `content.contacts[]` |
| `button_reply` | Enriquece com dados do botão original | `content.button_id` + `content.button_label` |
| `list_reply` | Enriquece com dados da lista original | `content.list_id` + `content.list_title` |
| `quoted` | Inclui mensagem citada no payload | `content.quoted_message` |
| `reaction` | Enriquece com mensagem reagida | `content.emoji` + `content.reacted_message_id` |
| `poll` | Parse de opções e votos | `content.poll_id` + `content.options[]` |
| `status_reply` | Identifica origin como "status" | `content.text` + `content.status_origin` |
| `call_missed` | Log + alerta opcional | `content.call_type` |

#### 3.2.4 Buffer Inteligente de Texto

- Sliding window configurável por instância (padrão 3.000ms)
- Flush forçado por: timeout, pontuação final (. ! ?), tamanho máximo acumulado
- Buffer adaptativo: aprende o padrão de digitação do usuário ao longo do tempo
- Detecção de mensagem incompleta: terminar com vírgula, reticências ou mid-sentence retém mais tempo
- Separação de tipo: se chegar áudio durante buffer de texto, flush imediato do texto antes de processar o áudio
- Merge automático das mensagens bufferizadas em payload único para o webhook

---

### 3.3 Módulo de Pipeline de Envio de Mensagens

#### 3.3.1 Responsabilidade

Validar, proteger, processar e entregar mensagens de saída ao WhatsApp de forma segura, rastreável e resiliente.

#### 3.3.2 Endpoint de Envio

```
POST /v1/instances/:id/messages
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `to` | string | Sim | Número destinatário E.164 ou group JID |
| `type` | enum | Sim | `text \| image \| audio \| video \| document \| sticker \| location \| vcard \| buttons \| list \| template` |
| `content` | object | Sim | Objeto específico do tipo de mensagem |
| `send_at` | ISO8601 | Não | Agendar envio futuro com timezone |
| `quoted_id` | string | Não | ID da mensagem a citar/responder |
| `metadata` | object | Não | Dados arbitrários devolvidos no webhook de confirmação |

> **Nota sobre envio de áudio (TTS):** O NexConnect **não gera áudio TTS**. O NexBot é responsável por gerar o arquivo `.ogg` via Vercel AI Gateway, fazer upload no R2 próprio e enviar a URL ao NexConnect para entrega. O NexConnect apenas recebe a URL e envia via Baileys.

#### 3.3.3 Estágios do Pipeline de Envio

- **Validation Stage** — schema validation, instância connected?, rate limit ok?
- **Phone Verification Stage** — número existe no WhatsApp? (cache Redis 24h)
- **Anti-Spam Stage** — throttling por instância, janela de horário, health score ok?
- **Media Prep Stage** — compressão de imagem/vídeo antes do envio, se aplicável
- **Delivery Stage** — envio via Baileys com message_delay configurado
- **Tracking Stage** — persiste no banco, dispara webhook `message.sent`
- **Status Tracking Stage** — aguarda `delivered`/`read` via Baileys events e atualiza timestamps

---

### 3.4 Módulo de Processamento de Mídia

#### 3.4.1 Responsabilidade

Operações de transporte de mídia: download, upload, STT de áudio, compressão e conversão de formato. Este módulo **não faz OCR, não faz TTS e não faz nenhuma inferência de IA** além da transcrição de áudio (STT), que é normalização de transporte.

#### 3.4.2 Subserviços (SRP)

| Subserviço | Classe | Responsabilidade |
|---|---|---|
| Download | `MediaDownloadService` | Download de mídia recebida dos servidores WhatsApp via Baileys + decrypt |
| Upload | `MediaUploadService` | Upload para R2 com URL permanente, content-type correto, metadata |
| STT | `SpeechToTextService` | Transcrição de áudio recebido via Whisper. Interface com múltiplos providers. |
| Compression | `MediaCompressionService` | Redução de tamanho de imagem/vídeo antes do envio (outbound) |
| Conversion | `MediaConversionService` | Conversão de formato para compatibilidade: .webp → .png, etc. |
| Thumbnail | `VideoThumbnailService` | Extração de frame de vídeo + geração de preview para o payload |

#### 3.4.3 STT — Providers Suportados

| Provider | Custo | Idiomas | Vantagem | Cenário |
|---|---|---|---|---|
| Whisper (OpenAI) | US$ 0,006/min | 99+ idiomas | Melhor custo-benefício, pt-BR excelente | Padrão |
| AssemblyAI | US$ 0,012/min | 99+ idiomas | Sentiment analysis, speaker diarization | Premium |
| Azure Speech | US$ 0,006/min + SLA | 90+ idiomas | SLA garantido, LGPD-ready | Enterprise |
| Workers AI (Whisper) | Incluído na infra CF | Limitado | Zero custo adicional | Fallback automático |

---

## 4. Sistema de Webhooks e Eventos

### 4.1 Arquitetura de Webhooks

O sistema de webhooks é event-driven e construído sobre os princípios de at-least-once delivery, idempotência e observabilidade completa. Todo evento é persistido antes da entrega.

#### 4.1.1 Configuração de Webhook

```typescript
interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  testUrl?: string;
  enabled: boolean;
  testMode: boolean;
  events: WebhookEvent[];
  secret: string;                              // HMAC-SHA256 secret — gerado automaticamente
  headers?: Record<string, string>;
  retryPolicy: {
    maxAttempts: number;                       // default 5
    backoffBase: number;                       // default 2.5 (exponencial)
  };
}
```

#### 4.1.2 Segurança — HMAC-SHA256

```
// Headers enviados em todo webhook:
X-NexConnect-Signature: sha256=<hmac_hex>
X-NexConnect-Event: message.received
X-NexConnect-Delivery-Id: <uuid>
X-NexConnect-Timestamp: <unix_timestamp>
```

```typescript
// Verificação no consumidor (Node.js):
const expectedSig = crypto
  .createHmac('sha256', webhookSecret)
  .update(rawBody)
  .digest('hex');
const isValid =
  `sha256=${expectedSig}` === req.headers['x-nexconnect-signature'];
```

#### 4.1.3 Política de Retry Exponencial

| Tentativa | Intervalo | Cálculo |
|---|---|---|
| 1ª | ~2.5 segundos | 2.5^1 |
| 2ª | ~6 segundos | 2.5^2 |
| 3ª | ~15 segundos | 2.5^3 |
| 4ª | ~39 segundos | 2.5^4 |
| 5ª | ~97 segundos | 2.5^5 |

Após 5 falhas, o evento é marcado como `dead_letter` e fica disponível para replay manual.

---

### 4.2 Catálogo Completo de Eventos (18 tipos)

#### 4.2.1 Eventos de Instância

| Evento | Quando dispara | Dados principais |
|---|---|---|
| `instance.connected` | Instância conectada com sucesso | id, profile_picture, phone_number |
| `instance.disconnected` | Instância desconectada | id, reason.code |
| `instance.qrcode` | Novo QR Code gerado ou atualizado | qrcode (base64), expires_at |
| `instance.mentioned` | Instância foi @mencionada num grupo | author, group, message |

#### 4.2.2 Eventos de Mensagem

| Evento | Quando dispara | Dados principais |
|---|---|---|
| `message.received` | Nova mensagem recebida | Payload completo normalizado |
| `message.sent` | Mensagem enviada | origin: `nexconnect \| whatsapp` |
| `message.delivered` | Mensagem entregue no aparelho | delivered_at timestamp |
| `message.read` | Mensagem lida pelo destinatário | read_at timestamp |
| `message.deleted` | Mensagem apagada | deleted_by, scope |
| `message.reaction` | Emoji aplicado a uma mensagem | reaction, reacted_by, reacted_message |
| `message.pinned` | Mensagem fixada | author, message, duration |
| `message.unpinned` | Mensagem desafixada | author, message |

#### 4.2.3 Eventos de Grupo

| Evento | Quando dispara | Dados principais |
|---|---|---|
| `group.created` | Novo grupo criado | group metadata completo |
| `group.updated` | Dados do grupo atualizados | nome, foto, descrição, settings |
| `group.participants_added` | Participantes adicionados | author, group, participants[] |
| `group.participants_removed` | Participantes removidos | author, group, participants[] |
| `group.participants_promoted` | Promovidos a administradores | author, group, participants[] |
| `group.participants_demoted` | Rebaixados de administradores | author, group, participants[] |

#### 4.2.4 Estrutura Padrão do Payload

```json
{
  "id": "evt_01HZ...",
  "type": "message.received",
  "instance_id": "ins_...",
  "tenant_id": "ten_...",
  "created_at": "2026-03-30T12:00:00.000Z",
  "data": {},
  "meta": {
    "delivery_attempt": 1,
    "replay": false
  }
}
```

### 4.3 Replay de Eventos

```json
// POST /v1/events/replay
{
  "from": "2026-03-30T10:00:00Z",
  "to": "2026-03-30T11:00:00Z",
  "event_types": ["message.received"],
  "instance_id": "ins_...",
  "target_url": "https://debug.myapp.com/webhook"
}
```

---

## 5. Módulo de Grupos

### 5.1 Endpoints de Grupos

| Método | Endpoint | Descrição |
|---|---|---|
| GET | /v1/instances/:id/groups | Listar grupos da instância |
| POST | /v1/instances/:id/groups | Criar novo grupo |
| GET | /v1/instances/:id/groups/:gid | Dados detalhados do grupo |
| PATCH | /v1/instances/:id/groups/:gid | Atualizar nome, foto, descrição, settings |
| DELETE | /v1/instances/:id/groups/:gid | Sair do grupo |
| GET | /v1/instances/:id/groups/:gid/participants | Listar participantes com roles |
| POST | /v1/instances/:id/groups/:gid/participants | Adicionar participantes |
| DELETE | /v1/instances/:id/groups/:gid/participants | Remover participantes |
| POST | /v1/instances/:id/groups/:gid/participants/promote | Promover a administradores |
| DELETE | /v1/instances/:id/groups/:gid/participants/demote | Rebaixar de administradores |
| POST | /v1/instances/:id/groups/join | Entrar via link de convite |
| GET | /v1/instances/:id/groups/:gid/invite-link | Obter link de convite |
| DELETE | /v1/instances/:id/groups/:gid/invite-link | Revogar link de convite |

---

## 6. Módulo de Utilitários

### 6.1 Verificação de Números

| Método | Endpoint | Descrição |
|---|---|---|
| GET | /v1/instances/:id/recipients/:number | Verificar se número tem WhatsApp + dados do perfil |
| POST | /v1/instances/:id/recipients/batch | Verificação em lote (até 100 números) |

### 6.2 Presence Update (Digitando... / Gravando...)

O indicador de "digitando..." é mantido ativo enquanto o NexBot processa a resposta no LLM. O NexConnect recebe o comando e o mantém via Baileys até a mensagem de resposta ser enviada.

```json
// PATCH /v1/instances/:id/presence
{
  "recipient": "5511999998888",
  "status": "typing",
  "duration_strategy": "until_next_message",
  "max_duration": 600
}
```

### 6.3 Agendamento Avançado de Mensagens

#### 6.3.1 Tipos de Agendamento

| Tipo | Campo | Exemplo | Descrição |
|---|---|---|---|
| One-time | `send_at` | `"2026-04-01T09:00:00-03:00"` | Envio único em data/hora específica |
| Recorrente | `cron` | `"0 9 * * MON-FRI"` | Cron expression padrão Unix |
| Smart Time | `smart_send_time: true` | — | Aprende horário ótimo por destinatário |
| Janela | `send_window` | `{ start: 9, end: 18, tz: "America/Sao_Paulo" }` | Só envia dentro do horário configurado |
| Batch | `schedule_file` | CSV: número,mensagem,horário | Import em bulk com CSV |

#### 6.3.2 Ciclo de Vida do Agendamento

| Status | Transição | Descrição |
|---|---|---|
| `scheduled` | → `sending` | Chegou no horário |
| `sending` | → `sent` | Enviado com sucesso |
| `sending` | → `failed` | Falhou após 3 tentativas |
| `scheduled` | → `canceled` | Cancelado via DELETE |
| `sent` | → `delivered` | Confirmação de entrega recebida |
| `sent` | → `read` | Confirmação de leitura recebida |

---

## 7. Proteção de Número e Saúde da Conta

### 7.1 Number Health Score (0–100)

| Componente | Peso | Descrição |
|---|---|---|
| Taxa de resposta dos destinatários | 30% | % de mensagens que receberam resposta nas últimas 48h |
| Taxa de leitura | 20% | % de mensagens com read_at confirmado |
| Taxa de bounces | 20% | Erros 131026 e similares |
| Idade da instância | 15% | Números mais antigos têm mais crédito |
| Volume relativo ao histórico | 15% | Spike repentino de volume reduz score |

Ações automáticas por score:

- **> 80:** operação normal
- **60–80:** throttling preventivo leve (+20% delay)
- **40–60:** throttling automático (-50% volume), notificação ao cliente
- **< 40:** pausa automática de proativos, apenas respostas permitidas

### 7.2 Warm-up Automático de Número Novo

| Dia | Limite Diário | Comportamento |
|---|---|---|
| 1–3 | 10 msgs/dia | Apenas respostas recebidas |
| 4–7 | 50 msgs/dia | Baixo volume, delay de 5–15s |
| 8–14 | 200 msgs/dia | Volume moderado, delay de 2–8s |
| 15–30 | 1.000 msgs/dia | Volume normal, delay de 1–3s |
| 30+ | Configurado | Limite por `rate_limit setting` |

### 7.3 Rotation Pool para Broadcasts

```json
// POST /v1/broadcasts
{
  "instance_pool": ["ins_001", "ins_002", "ins_003"],
  "strategy": "round_robin",
  "messages": [
    { "to": "5511999990001", "type": "text", "content": { "text": "Olá!" } }
  ],
  "send_window": { "start": 9, "end": 18, "tz": "America/Sao_Paulo" }
}
```

### 7.4 Blacklist e Anti-Spam

- Blacklist automática de números que retornam erro repetido (configurável: após N falhas)
- Detecção de padrão de spam: muitos destinatários não respondem → throttling automático
- Cooldown entre mensagens para o mesmo número
- Whitelist de números sempre permitidos

---

## 8. Segurança e Compliance

### 8.1 Autenticação e Autorização

| Mecanismo | Aplicação | Detalhes |
|---|---|---|
| API Keys | Autenticação principal de clientes | Prefixo `nc_` com hash SHA-256. Bearer no header Authorization. |
| Scoped Keys | Permissões granulares | Escopos: `read-only`, `send-only`, `admin` |
| Webhook HMAC | Verificação de autenticidade do payload | HMAC-SHA256 por webhook. Header X-NexConnect-Signature. |
| JWT Interno | Comunicação entre pods | Tokens efêmeros RS256 para comunicação inter-serviços |
| IP Allowlist | Proteção adicional por instância | Lista de IPs autorizados por tenant |

### 8.2 Criptografia

- Auth state Baileys: **AES-256-GCM** em repouso no PostgreSQL
- API Keys: hash **bcrypt** (salt 12), nunca plain text
- Webhook secrets: criptografados com AES-256 antes de persistir
- URLs de mídia R2: assinadas com TTL configurável
- Comunicação entre serviços: **TLS 1.3** obrigatório

### 8.3 LGPD Compliance

- PII redaction automático em logs (CPF, CNPJ, cartão, telefone)
- Audit trail imutável para toda operação sensível
- Data retention configurável por tenant
- Export de dados: `GET /v1/tenants/:id/data/export`
- Right to erasure: `DELETE /v1/tenants/:id/data`

### 8.4 Rate Limiting

| Nível | Limite Padrão | Configurável |
|---|---|---|
| Por API Key | 1.000 req/min | Sim — por tenant |
| Por instância | 100 msgs/min | Sim — por instância |
| Por destinatário | 10 msgs/min | Sim — evita flooding |
| Webhook delivery | 500 eventos/min | Não — proteção do sistema |
| Media upload | 50 MB/min | Sim — por tenant |

---

## 9. Observabilidade e Monitoramento

### 9.1 Stack de Observabilidade

| Componente | Tecnologia | Função |
|---|---|---|
| Traces | OpenTelemetry → Jaeger | Request tracing com span por estágio da pipeline |
| Métricas | Prometheus + Grafana | Instâncias, throughput, latências, erros |
| Logs | Pino (structured JSON) → Loki | Logs indexados, sem dados sensíveis |
| Alertas | Grafana Alerting | Saúde de número, falhas de webhook, disco |
| Load | k6 | Performance testing e validação de SLOs |

### 9.2 Métricas por Instância

Via `GET /v1/instances/:id/metrics`:

- `messages_received_total` — por tipo de mensagem
- `messages_sent_total` — por tipo e status
- `messages_sent_failed_total` — por código de erro
- `webhook_delivery_latency_ms` — histograma
- `media_processing_duration_ms` — por tipo de mídia
- `stt_transcription_duration_ms` — latência de transcrição por provider
- `number_health_score` — gauge contínuo (0–100)
- `connection_uptime_seconds` — uptime da sessão Baileys
- `reconnection_count` — reconexões no período
- `buffer_flush_count` — flushes do buffer de texto

### 9.3 Alertas Proativos

| Alerta | Condição | Ação |
|---|---|---|
| Number Health Critical | health_score < 40 | Pausa proativos + webhook `instance.health_warning` |
| High Error Rate | error_rate > 10% em 5 min | Notifica + sugere throttling |
| Webhook Dead Letters | > 10 eventos em dead_letter | Notifica + link para replay |
| Session Disconnected | instance offline > 30s | Tenta reconexão automática (5x) + notifica se falhar |
| Storage High Usage | R2 usage > 80% | Notifica admin |
| Rate Limit Approaching | usage > 80% | Notifica cliente |

---

## 10. Developer Experience (DX)

### 10.1 SDK Oficial TypeScript

```bash
npm install @nexconnect/sdk
```

```typescript
import { NexConnect } from '@nexconnect/sdk';

const client = new NexConnect({ apiKey: process.env.NEXCONNECT_API_KEY });

const instance = await client.instances.create({
  name: 'Suporte Principal',
  settings: { bufferEnabled: true, bufferWindowMs: 3000, sttEnabled: true },
});

await client.messages.send(instance.id, {
  to: '+5511999998888',
  type: 'text',
  content: { text: 'Olá! Como posso ajudar?' },
});

client.on('message.received', async (event) => {
  console.log(event.data.content.text);
  // Para áudio: event.data.content.transcription (já transcrito)
  // Para imagem: event.data.content.media_url (NexBot decide o que fazer)
});
```

### 10.2 Sandbox Environment

- Instâncias sandbox simulam envio e recebimento sem número real
- Webhook tester embutido: dispara eventos simulados para testar integração
- Quotas separadas: sandbox nunca consome limite de produção
- Acesso via `sandbox.nexconnect.io`

### 10.3 Documentação e Ferramentas

- OpenAPI 3.1 spec completa com exemplos em múltiplas linguagens
- Postman Collection exportável
- CLI: `nexconnect instances list`, `nexconnect send`, `nexconnect logs tail`
- Webhook debugger: inspecionar últimos 100 eventos de qualquer webhook

---

## 11. Multi-tenancy e Isolamento

### 11.1 Modelo de Tenancy

| Recurso | Isolamento | Detalhes |
|---|---|---|
| Instâncias | Row-Level Security por tenant_id | Nenhum tenant acessa instâncias de outro |
| API Keys | Escopadas por tenant | Key de um tenant não funciona em endpoints de outro |
| Webhooks | Por tenant | Eventos nunca vazam entre tenants |
| Métricas | Por tenant | Dashboard separado, sem cross-contaminação |
| Armazenamento | Por tenant no R2 | Path: `/tenants/{id}/media/...` |
| Logs | Indexados por tenant_id | Queries de log isoladas |
| Rate Limits | Por tenant | Consumo de um tenant não afeta outro |

### 11.2 White-label da API

- Custom domain: `api.minhaempresa.com.br` apontando para NexConnect
- Custom branding nos headers e respostas de erro
- Webhook events com namespace customizado: `minhaempresa.message.received`

---

## 12. Features Avançadas e Diferenciais

### 12.1 WhatsApp Stories e Channels

- `POST /v1/instances/:id/stories` — publicar story com duração configurável
- `GET /v1/instances/:id/stories` — listar stories ativos com métricas
- `DELETE /v1/instances/:id/stories/:id` — remover story
- `POST /v1/instances/:id/channels/publish` — publicar em WhatsApp Channels
- `GET /v1/instances/:id/channels` — listar channels seguidos

### 12.2 Reações Programáticas

```json
// POST /v1/instances/:id/messages/:msg_id/reactions
{ "emoji": "👍" }
```

### 12.3 Smart Buffer Adaptativo

- Mantém histórico das últimas 50 interações de cada contato
- Calcula média de tempo entre mensagens consecutivas
- Ajusta janela de buffer: usuário rápido tem janela menor, lento tem janela maior
- Detecta "mensagem longa dividida em múltiplos envios" e aguarda o conjunto completo

### 12.4 Broadcast Engine

- Import de lista via CSV/JSON com até 100.000 destinatários
- Distribuição automática entre pool de instâncias
- Rate limiting baseado no health score de cada número
- Relatório em tempo real: entregues, lidos, bounces, falhas
- A/B testing nativo: variações de mensagem com split configurável
- Pausa e retomada de campanha

---

## 13. Modelo de Dados

### 13.1 Entidades Principais

| Entidade | Tabela | Campos Chave |
|---|---|---|
| Tenant | `tenants` | id, name, plan, api_keys[], settings, created_at |
| Instance | `instances` | id, tenant_id, name, phone_number, status, connection_type, settings (JSONB), auth_state_encrypted, pod_id, health_score |
| Webhook | `webhooks` | id, instance_id, tenant_id, url, events[], secret_encrypted, enabled, test_mode |
| Message | `messages` | id (ULID), instance_id, tenant_id, wa_message_id, direction, type, content (JSONB), status, sent_at, delivered_at, read_at, failed_at |
| Event | `events` | id (ULID), tenant_id, instance_id, type, payload (JSONB), created_at (particionado por mês) |
| WebhookDelivery | `webhook_deliveries` | id, event_id, webhook_id, attempt, status, response_code, duration_ms |
| MediaAsset | `media_assets` | id, tenant_id, instance_id, message_id, type, r2_key, url, size_bytes, transcription, created_at |
| NumberHealth | `number_health` | instance_id, score, response_rate, read_rate, bounce_rate, volume_score, calculated_at |
| ScheduledMsg | `scheduled_messages` | id, instance_id, tenant_id, payload (JSONB), status, send_at, cron, sent_at, failed_at, attempt |
| AuditLog | `audit_logs` | id, tenant_id, actor_id, action, resource_type, resource_id, ip, metadata (JSONB), created_at |

> **Nota:** O campo `ocr_text` foi removido de `media_assets`. OCR é responsabilidade do Vektus, que persiste seus próprios dados. O NexConnect armazena apenas `transcription` (STT de áudio).

### 13.2 Índices Críticos

- `instances`: `(tenant_id, status)`
- `messages`: `(instance_id, direction, created_at DESC)`
- `messages`: `(wa_message_id) UNIQUE` — deduplicação
- `events`: `(tenant_id, type, created_at)`
- `webhook_deliveries`: `(event_id, status)`
- `audit_logs`: `(tenant_id, created_at DESC)`
- `number_health`: `(instance_id)`

---

## 14. Estrutura de Código e Padrões

### 14.1 Estrutura de Pastas (NestJS Modular)

```
nexconnect/
├── apps/
│   ├── api/                      # API Gateway (REST + WebSocket)
│   └── worker/                   # Worker pods (Baileys + Message Processor)
├── libs/
│   ├── core/                     # Entidades, interfaces, DTOs compartilhados
│   ├── database/                 # Prisma schema, migrations, repositories
│   ├── redis/                    # Redis client, pub/sub, cache abstractions
│   └── shared/                   # Utils, constants, enums, exceptions
└── apps/api/src/
    ├── modules/
    │   ├── instances/
    │   ├── messages/
    │   ├── webhooks/
    │   ├── groups/
    │   ├── media/
    │   ├── scheduling/
    │   ├── broadcasts/
    │   ├── health/               # Number health score
    │   ├── tenants/
    │   └── auth/
    └── common/
        ├── filters/
        ├── guards/
        ├── interceptors/
        ├── pipes/
        └── decorators/
```

```
apps/worker/src/
├── pipeline/
│   ├── stages/
│   │   ├── deduplication.stage.ts
│   │   ├── classification.stage.ts
│   │   ├── buffer.stage.ts
│   │   ├── media-processing.stage.ts  # download + upload R2 + STT (áudio)
│   │   ├── enrichment.stage.ts
│   │   ├── presence.stage.ts
│   │   └── forward.stage.ts
│   └── message-pipeline.service.ts
├── connection/
│   ├── baileys-connection.service.ts
│   ├── connection-pool.service.ts
│   ├── session-persistence.service.ts
│   └── reconnection.service.ts
└── workers/
```

### 14.2 Padrões Obrigatórios

**SRP — exemplos corretos:**
- `MessageDeduplicationService` — apenas deduplicação
- `BaileysConnectionService` — apenas WebSocket WhatsApp
- `SpeechToTextService` — apenas transcrição de áudio (STT)
- `WebhookSignatureService` — apenas HMAC-SHA256
- `NumberHealthCalculatorService` — apenas health score

**Logs estruturados (Pino):**
```typescript
// ✅ CORRETO
this.logger.info({ instanceId, messageId, type, durationMs }, 'message.processed');

// ❌ ERRADO
console.log(`Message ${messageId} processed in ${durationMs}ms`);
```

**Hierarquia de exceções:**
```
NexConnectException (base)
├── InstanceNotFoundException
├── InstanceOfflineException
├── RateLimitExceededException
├── InvalidPhoneNumberException
├── MediaProcessingException
└── WebhookDeliveryException
```

---

## 15. Roadmap de Implementação

### 15.1 Visão Geral

| Fase | Semanas | Foco | Entrega Principal |
|---|---|---|---|
| Fase 1 — Core | 1–4 | Fundação e MVP | Instâncias, QR Code, texto, webhooks básicos |
| Fase 2 — Media | 5–8 | Mídia e STT | Pipeline completa, Whisper STT, upload R2, todos os tipos |
| Fase 3 — Intelligence | 9–12 | Buffer e Proteção | Buffer adaptativo, health score, warm-up |
| Fase 4 — Scale | 13–16 | Escala e Resiliência | Pod isolation, session persistence, circuit breaker |
| Fase 5 — Enterprise | 17–20 | Segurança e LGPD | HMAC completo, criptografia, RLS, audit trail |
| Fase 6 — DX e Advanced | 21–24 | SDK e Features | SDK, sandbox, Stories/Channels, Broadcast Engine |

### 15.2 Fase 1 — Core (Semanas 1–4)

- Monorepo Turborepo + NestJS (api + worker) + Prisma schema + Docker + Infisical + CI/CD
- Auth: API key generation, validation, scopes
- Baileys connection: criar conexão, QR Code, Pairing Code, sessão básica
- Instance CRUD básico
- Message pipeline básica: dedup + classify + forward (sem buffer/mídia)
- Webhook system: CRUD, delivery, retry exponencial básico
- Envio de texto com message_delay
- Testes unitários: pipeline stages (Vitest)
- Contrato de inbound com NexBot definido e testado

### 15.3 Fase 2 — Media (Semanas 5–8)

- `MediaDownloadService`: download + decrypt via Baileys
- `MediaUploadService`: upload para R2 com URL permanente
- `SpeechToTextService`: integração Whisper API — interface com múltiplos providers
- `VideoThumbnailService`: extração de frame e metadata
- `MediaCompressionService`: redução de tamanho pré-envio
- `MediaConversionService`: conversão de formato para compatibilidade
- Pipeline completa com todos os estágios ativos
- Testes de integração: Testcontainers com banco real

### 15.4 Fase 3 — Intelligence (Semanas 9–12)

- `MessageBufferService`: sliding window + flush conditions
- Buffer adaptativo: aprendizado por histórico do usuário
- `PresenceUpdateService`: until_next_message strategy
- `NumberHealthCalculatorService`: score contínuo com todos os componentes
- `WarmUpService`: progressão automática de volume em números novos
- `AntiSpamService`: blacklist automática, detecção de padrão
- Agendamento avançado: cron, janela de envio, smart time
- Alertas proativos via webhook `instance.health_warning`

### 15.5 Fase 4 — Scale (Semanas 13–16)

- Pod architecture: distribuição de instâncias entre pods
- Session persistence: auth state no PostgreSQL, recuperação após crash
- Circuit breaker por instância
- Redis Pub/Sub entre pods
- Auto-reconnect com backoff exponencial e jitter
- Zero-downtime deploy: graceful shutdown com migração de instâncias
- Load testing: k6 com 300 instâncias simultâneas

### 15.6 Fase 5 — Enterprise (Semanas 17–20)

- HMAC-SHA256 completo em todos os webhooks
- Criptografia AES-256-GCM do auth state em repouso
- LGPD: PII redaction, data retention, export e erasure
- Audit trail imutável
- IP allowlist por tenant
- Scoped API keys
- Multi-tenant RLS completo no PostgreSQL
- Replay de eventos com filtros avançados

### 15.7 Fase 6 — DX e Advanced (Semanas 21–24)

- SDK TypeScript `@nexconnect/sdk` publicado no npm
- OpenAPI 3.1 spec completa + geração automática
- Sandbox environment
- CLI `nexconnect`
- Stories API + WhatsApp Channels
- Broadcast Engine com pool rotation e A/B testing
- Reaction API
- Documentação em `developer.nexconnect.io`

---

## 16. Estratégia de Testes

### 16.1 Pirâmide de Testes

| Nível | Ferramenta | Cobertura Mínima | O que testa |
|---|---|---|---|
| Unit | Vitest | 90% | Cada estágio da pipeline isoladamente, services, helpers |
| Integration | Vitest + Testcontainers | 70% | Módulos com banco e Redis reais em Docker |
| E2E | Supertest + Vitest | 50% | Fluxos completos HTTP da API |
| Load | k6 | SLO | 300 instâncias simultâneas, 10k msgs/min, latência < 500ms |
| Contract | Pact | 100% | Contrato de API com NexBot |

### 16.2 SLOs (Service Level Objectives)

| Métrica | Target | Crítico |
|---|---|---|
| Latência de forward de webhook (p95) | < 500ms | < 1s |
| Latência de STT — áudio de 30s (p95) | < 3s | < 5s |
| Uptime de instâncias conectadas | > 99.5% | > 99% |
| Taxa de entrega de webhooks | > 99.9% | > 99.5% |
| Tempo de reconexão após queda | < 30s | < 60s |
| Throughput máximo por pod (30 instâncias) | > 3.000 msgs/min | N/A |

> **Nota:** A métrica de "Latência de OCR" foi removida — OCR não é responsabilidade do NexConnect.

---

## 17. Integração com o NexBot

### 17.1 Contrato de Inbound (NexConnect → NexBot)

O NexConnect entrega ao NexBot um payload normalizado, limpo e pronto para inferência. O NexBot nunca lida com Baileys, mídia bruta, buffering ou STT.

```
POST {nexbot_url}/api/channels/whatsapp/inbound/{instanceId}
Headers:
  Authorization: Bearer {NEXBOT_CHANNEL_SECRET}
  X-NexConnect-Signature: sha256=<hmac>
  X-NexConnect-Event: message.received
  X-NexConnect-Instance-Id: ins_...
  X-NexConnect-Tenant-Id: ten_...
```

```json
{
  "id": "evt_01HZ...",
  "type": "message.received",
  "instance_id": "ins_...",
  "tenant_id": "ten_...",
  "created_at": "2026-03-30T12:00:00.000Z",
  "data": {
    "message_id": "3AAB4DA4297176B74E38",
    "type": "text | audio | image | video | document | ...",
    "from": "+5511999998888",
    "from_name": "João Silva",
    "is_group": false,
    "content": {
      "text": "mensagem já bufferizada",
      "transcription": "...",     // presente APENAS se type=audio (STT feito no NexConnect)
      "media_url": "https://r2.nexconnect.io/...",  // URL R2 permanente
      "thumbnail_url": "...",     // presente se type=video
      "filename": "...",          // presente se type=document
      "latitude": -23.5,          // presente se type=location
      "longitude": -46.6          // presente se type=location
    },
    "buffered_messages": 3,
    "sent_at": "2026-03-30T12:00:00.000Z"
  }
}
```

**Importante:** Para `type=image`, o payload contém apenas `media_url`. O NexBot decide o que fazer: chamar o Vektus para OCR ou passar para Vision LLM via Vercel AI Gateway. O NexConnect não toma essa decisão.

### 17.2 Responsabilidades — Separação Definitiva

| Responsabilidade | NexConnect | NexBot | Vektus |
|---|---|---|---|
| Conexão WebSocket WhatsApp | ✅ | ❌ | ❌ |
| Gestão de sessão Baileys | ✅ | ❌ | ❌ |
| QR Code / Pairing Code | ✅ | ❌ | ❌ |
| Buffer de mensagens de texto | ✅ | ❌ | ❌ |
| Deduplicação de mensagens | ✅ | ❌ | ❌ |
| Classificação de tipo de mensagem | ✅ | ❌ | ❌ |
| Download mídia → upload R2 | ✅ | ❌ | ❌ |
| STT — transcrição de áudio | ✅ | ❌ | ❌ |
| Presence update (digitando...) | ✅ | ❌ | ❌ |
| Proteção de número / throttling | ✅ | ❌ | ❌ |
| Warm-up de número novo | ✅ | ❌ | ❌ |
| Forward via webhook + retry + HMAC | ✅ | ❌ | ❌ |
| OCR de imagens | ❌ | ❌ | ✅ |
| RAG / Knowledge Base | ❌ | ❌ | ✅ |
| Chunking + embeddings + pgvector | ❌ | ❌ | ✅ |
| Skills Engine L1/L2/L3 | ❌ | ❌ | ✅ |
| Vision LLM (análise de imagem) | ❌ | ✅ via AI Gateway | ❌ |
| TTS (geração de .ogg de resposta) | ❌ | ✅ via AI Gateway | ❌ |
| LLM routing / inferência | ❌ | ✅ via AI Gateway | ❌ |
| Agent Builder / Handoff / Analytics | ❌ | ✅ | ❌ |
| Billing / multi-tenancy da plataforma | ❌ | ✅ | ❌ |

---

## 18. Decisões Técnicas e ADRs

### 18.1 ADR-001: Baileys como engine WebSocket

**Decisão:** `@WhiskeySockets/Baileys`

Alternativas: whatsapp-web.js (Puppeteer), WA-JS, implementação própria.

**Justificativa:** Baileys conecta diretamente via WebSocket sem browser (~10x menos RAM: 50–150MB vs 400–800MB do Puppeteer). TypeScript nativo, suporte multi-device, mesma base dos providers comerciais — validação de mercado.

### 18.2 ADR-002: PostgreSQL para session persistence

**Decisão:** Auth state Baileys criptografado no PostgreSQL.

Alternativas: arquivo em disco, Redis, S3.

**Justificativa:** Arquivo em disco é incompatível com pods horizontais. Redis pode perder dados (TTL). S3 tem latência alta. PostgreSQL oferece durabilidade, consistência e queries eficientes para recuperação de sessão por pod.

### 18.3 ADR-003: 30 instâncias por Worker Pod

**Decisão:** Máximo 30 instâncias Baileys por processo Node.js.

**Justificativa:** Cada instância consome 50–150MB de RAM. Com 30 instâncias, um pod usa ~3–4GB — dentro do limite seguro de 6GB por container. Limite ajustável via variável de ambiente.

### 18.4 ADR-004: BullMQ para filas

**Decisão:** BullMQ (Redis-backed).

Alternativas: SQS, RabbitMQ, Kafka, Inngest.

**Justificativa:** Priority queues nativas (mensagens urgentes vs broadcasts), rate limiting por queue, retry com backoff, delayed jobs, visibilidade em tempo real. Redis já é dependência — sem nova infraestrutura.

### 18.5 ADR-005: ULID para IDs de eventos e mensagens

**Decisão:** ULID (Universally Unique Lexicographically Sortable Identifier).

Alternativas: UUID v4, UUID v7, auto-increment.

**Justificativa:** Ordenável lexicograficamente (queries de range temporal sem índice separado), colisão praticamente impossível, safe para exposição externa.

### 18.6 ADR-006: STT no NexConnect (não no NexBot)

**Decisão:** Transcrição de áudio (STT via Whisper) é executada no NexConnect antes do forward.

Alternativas: STT no NexBot após receber a URL do áudio.

**Justificativa:** O NexBot deve sempre receber um payload normalizado e pronto para inferência. Entregar áudio bruto ao NexBot quebraria esse contrato — o NexBot precisaria saber sobre formatos de áudio do Baileys, URLs temporárias e timing de processamento, que são responsabilidades de transporte. STT é normalização, não inferência de negócio.

### 18.7 ADR-007: OCR e TTS fora do NexConnect

**Decisão:** OCR de imagens é responsabilidade do Vektus. TTS é responsabilidade do NexBot via Vercel AI Gateway.

**Justificativa:** OCR de documentos é o core business do Vektus — qualidade superior, sem duplicação de esforço. TTS é geração de conteúdo de resposta — decisão de negócio do NexBot, não transporte. O NexConnect entrega imagens como URLs R2 e recebe URLs de áudio para enviar. Zero IA além do STT.

---

## 19. Glossário

| Termo | Definição |
|---|---|
| Instância | Unidade de conexão WhatsApp. Um número de telefone = uma instância. |
| Baileys | Biblioteca TypeScript que implementa o protocolo WhatsApp Web via WebSocket. |
| Worker Pod | Processo Node.js responsável por até 30 instâncias Baileys. |
| Auth State | Credenciais criptografadas da sessão Baileys. Permitem reconectar sem novo QR Code. |
| Buffer Window | Janela de tempo para acumular mensagens de texto antes de processar. |
| Health Score | Score 0–100 que mede a saúde de um número WhatsApp. |
| Warm-up | Aumento gradual de volume de envio para números novos. |
| WABA | WhatsApp Business Account — conta oficial Meta Cloud API. |
| Pairing Code | Código numérico de 8 dígitos alternativo ao QR Code. |
| Dead Letter | Evento que falhou em todas as tentativas de entrega. Aguarda replay manual. |
| PTT | Push-to-talk — formato de mensagem de voz nativa do WhatsApp. |
| STT | Speech-to-Text — transcrição de áudio em texto. Executado no NexConnect via Whisper. |
| HMAC | Hash-based Message Authentication Code — verificação de integridade de payload. |
| Circuit Breaker | Padrão de resiliência que desativa instância com falhas repetidas temporariamente. |
| ULID | Universally Unique Lexicographically Sortable Identifier. |
| Tenant | Cliente do NexBot com instâncias e dados isolados. |
| Rotation Pool | Pool de instâncias para broadcasts em rodízio. |
| Forward | Ato de entregar o payload normalizado ao NexBot via webhook. |

---

## 20. Histórico de Versões

| Versão | Data | Autor | Descrição |
|---|---|---|---|
| 1.0 | Março 2025 | Wesley Lima — Orbitmind | Documento inicial |
| 1.1 | Março 2026 | Wesley Lima — Orbitmind | Correção arquitetural: OCR, TTS, RAG e Vision LLM removidos. NexConnect é transporte puro + STT. ADR-006 e ADR-007 adicionados. Campo `ocr_text` removido de `media_assets`. SLO de OCR removido. Seção 12.4 removida. |

---

*NexConnect PRD v1.1 — CONFIDENCIAL — Orbitmind — Março 2026*

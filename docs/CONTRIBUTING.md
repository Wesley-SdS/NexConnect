# Contribuindo com o NexConnect

## Padrões Obrigatórios

### Clean Code

- Nomenclatura expressiva e autoexplicativa
- Funções pequenas (max ~20 linhas)
- Zero magic numbers — use constants
- Sem comentários óbvios — código deve ser autoexplicativo
- Comentários apenas para decisões não-óbvias (link para ADR)

### SOLID

- **SRP (Obrigatório):** cada classe/módulo tem exatamente UMA razão para mudar
- **OCP:** extensível por composição, não por modificação
- **LSP:** subtipos devem substituir tipos base
- **ISP:** interfaces específicas, não interfaces genéricas
- **DIP:** dependa de abstrações, não de implementações

### Exemplos SRP Corretos

```typescript
// Cada service tem UMA responsabilidade
MessageDeduplicationService   // apenas deduplicação
BaileysConnectionService      // apenas WebSocket WhatsApp
SpeechToTextService           // apenas transcrição de áudio
WebhookSignatureService       // apenas HMAC-SHA256
NumberHealthCalculatorService // apenas health score
```

### Logging

```typescript
// CORRETO — Pino estruturado
this.logger.info({ instanceId, messageId, type, durationMs }, 'message.processed');

// ERRADO — console.log
console.log(`Message ${messageId} processed in ${durationMs}ms`);
```

### Exceções

Use a hierarquia de exceções do projeto:

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

## Estrutura de Commits

```
tipo(escopo): descrição curta

corpo opcional com mais detalhes
```

**Tipos:** feat, fix, refactor, docs, test, chore, perf, ci

**Escopos:** api, worker, core, database, redis, shared, pipeline, instances, messages, webhooks

**Exemplos:**
```
feat(pipeline): adicionar buffer adaptativo por contato
fix(worker): corrigir reconexão após timeout de sessão
refactor(api): extrair validação de phone para PhoneUtil
test(pipeline): adicionar testes unitários do dedup stage
```

---

## Testes

### Estrutura

```
src/
├── module/
│   ├── module.service.ts
│   └── __tests__/
│       ├── module.service.spec.ts      # unit
│       ├── module.service.int.spec.ts  # integration
│       └── module.controller.e2e.spec.ts
```

### Cobertura Mínima

| Nível | Target |
|---|---|
| Unit | 90% |
| Integration | 70% |
| E2E | 50% |

### Executar

```bash
pnpm test              # unitários
pnpm test:cov          # com cobertura
pnpm test:e2e          # e2e
```

---

## Setup de Desenvolvimento

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres redis
pnpm db:generate
pnpm db:migrate
pnpm dev
```

---

## Code Review Checklist

- [ ] SRP respeitado — cada classe tem uma responsabilidade
- [ ] Sem console.log — usar Logger do NestJS (Pino)
- [ ] Sem magic numbers — usar constants
- [ ] Exceções tipadas — usar hierarquia NexConnectException
- [ ] Logs estruturados — objetos JSON, não strings
- [ ] Testes unitários adicionados/atualizados
- [ ] DTOs com validação (class-validator)
- [ ] Sem dados sensíveis em logs (PII redaction)

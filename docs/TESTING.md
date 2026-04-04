# Estratégia de Testes

## Pirâmide de Testes

| Nível | Ferramenta | Cobertura Mínima | O que testa |
|---|---|---|---|
| Unit | Vitest | 90% | Pipeline stages, services, utils |
| Integration | Vitest + Testcontainers | 70% | Módulos com banco e Redis reais |
| E2E | Supertest + Vitest | 50% | Fluxos HTTP completos |
| Load | k6 | SLO | Performance e limites |
| Contract | Pact | 100% | Contrato com NexBot |

---

## Executar Testes

```bash
# Todos os unitários
pnpm test

# Com cobertura
pnpm test:cov

# E2E
pnpm test:e2e

# Watch mode
pnpm test -- --watch

# Arquivo específico
pnpm test -- deduplication.stage.spec.ts
```

---

## Estrutura de Testes

```
src/
├── module/
│   ├── module.service.ts
│   └── __tests__/
│       ├── module.service.spec.ts        # unit
│       ├── module.service.int.spec.ts    # integration
│       └── module.controller.e2e.spec.ts # e2e
```

---

## Testes Unitários

### Pipeline Stages

Cada stage da pipeline tem testes isolados:

- `deduplication.stage.spec.ts` — testa dedup com mock Redis
- `classification.stage.spec.ts` — testa classificação de 15 tipos
- `buffer.stage.spec.ts` — testa flush conditions
- `enrichment.stage.spec.ts` — testa enriquecimento de metadata
- `forward.stage.spec.ts` — testa build de payload e enqueue
- `message-pipeline.service.spec.ts` — testa orchestração

### Services

- `auth.service.spec.ts` — validação e criação de API keys
- `instances.service.spec.ts` — CRUD com guards
- `messages.service.spec.ts` — validação e envio
- `webhook-dispatch.service.spec.ts` — build de payload e headers
- `number-health-calculator.service.spec.ts` — cálculo de score
- `speech-to-text.service.spec.ts` — fallback entre providers

### Utils

- `phone.util.spec.ts` — normalização e validação
- `crypto.util.spec.ts` — HMAC, encrypt/decrypt, API keys

### Guards

- `api-key.guard.spec.ts` — autenticação

---

## Convenções

- Mocks são criados inline, não em arquivos separados
- Use `vi.fn()` para mocks, `vi.spyOn()` para spies
- Nomeie testes com "should" + verbo: `it('should reject duplicates')`
- Agrupe por método/behavior com `describe`
- Cada teste deve ser independente (reset via `beforeEach`)

---

## SLOs (Service Level Objectives)

| Métrica | Target | Crítico |
|---|---|---|
| Latência de forward (p95) | < 500ms | < 1s |
| Latência de STT 30s (p95) | < 3s | < 5s |
| Uptime de instâncias | > 99.5% | > 99% |
| Taxa de entrega webhooks | > 99.9% | > 99.5% |
| Tempo de reconexão | < 30s | < 60s |
| Throughput por pod | > 3.000 msgs/min | - |

# Deployment Guide

## Pré-requisitos

- Docker + Kubernetes (k3s para dev)
- PostgreSQL 16+
- Redis 7+
- Cloudflare R2 (storage de mídia)
- Infisical (secrets management)

---

## Variáveis de Ambiente

Todas as variáveis estão documentadas em `.env.example`.

### Obrigatórias

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL |
| `REDIS_HOST` | Host do Redis |
| `REDIS_PORT` | Porta do Redis |
| `ENCRYPTION_KEY` | Chave AES-256 (32 bytes) para criptografia em repouso |
| `JWT_SECRET` | Secret para JWT inter-serviços |

### R2 (Storage)

| Variável | Descrição |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | Access Key |
| `R2_SECRET_ACCESS_KEY` | Secret Key |
| `R2_BUCKET_NAME` | Nome do bucket |
| `R2_PUBLIC_URL` | URL pública do bucket |

### STT (Speech-to-Text)

| Variável | Descrição |
|---|---|
| `STT_PROVIDER` | Provider padrão: whisper, assemblyai, azure |
| `OPENAI_API_KEY` | API Key OpenAI (Whisper) |

---

## Docker Compose (Desenvolvimento)

```bash
# Subir tudo
docker compose up -d

# Apenas infra (PostgreSQL + Redis)
docker compose up -d postgres redis

# Logs
docker compose logs -f api
docker compose logs -f worker
```

---

## Kubernetes (Produção)

### API Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nexconnect-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nexconnect-api
  template:
    metadata:
      labels:
        app: nexconnect-api
    spec:
      containers:
        - name: api
          image: nexconnect-api:latest
          ports:
            - containerPort: 3100
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          envFrom:
            - secretRef:
                name: nexconnect-secrets
          readinessProbe:
            httpGet:
              path: /v1/health
              port: 3100
            initialDelaySeconds: 10
          livenessProbe:
            httpGet:
              path: /v1/health
              port: 3100
            initialDelaySeconds: 15
```

### Worker Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nexconnect-worker
spec:
  replicas: 10  # 10 pods * 30 instancias = 300 instancias
  selector:
    matchLabels:
      app: nexconnect-worker
  template:
    metadata:
      labels:
        app: nexconnect-worker
    spec:
      containers:
        - name: worker
          image: nexconnect-worker:latest
          resources:
            requests:
              memory: "4Gi"
              cpu: "1000m"
            limits:
              memory: "6Gi"
              cpu: "2000m"
          envFrom:
            - secretRef:
                name: nexconnect-secrets
          env:
            - name: WORKER_MAX_INSTANCES_PER_POD
              value: "30"
            - name: WORKER_POD_ID
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
```

### HPA (Auto-scaling)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: nexconnect-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nexconnect-worker
  minReplicas: 2
  maxReplicas: 50
  metrics:
    - type: Pods
      pods:
        metric:
          name: active_instances
        target:
          type: AverageValue
          averageValue: "25"
```

---

## Scaling

| Instâncias | Pods Worker | RAM Total | Observação |
|---|---|---|---|
| 30 | 1 | ~4GB | Dev/staging |
| 300 | 10 | ~40GB | Produção inicial |
| 1.000 | 34 | ~136GB | Escala média |
| 10.000 | 334 | ~1.3TB | Enterprise |

---

## Migrations

```bash
# Gerar migration
pnpm db:migrate

# Aplicar em produção
DATABASE_URL="production_url" pnpm db:migrate

# Prisma Studio (debug)
pnpm db:studio
```

---

## Monitoramento

### Grafana Dashboards

- **NexConnect Overview**: instâncias ativas, throughput, latências
- **Pipeline Performance**: duração por estágio, taxa de erros
- **Number Health**: scores, throttling, warm-up progress
- **Webhook Delivery**: entregas, retries, dead letters

### Alertas Críticos

| Alerta | Condição |
|---|---|
| Health Score Critical | score < 40 |
| High Error Rate | error_rate > 10% em 5min |
| Webhook Dead Letters | > 10 eventos em dead_letter |
| Session Disconnected | offline > 30s |
| Pod Memory High | usage > 80% |

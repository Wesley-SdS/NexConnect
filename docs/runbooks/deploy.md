# Deploy Runbook

## Pre-flight Checks

1. **Verify branch state**
   ```bash
   git log --oneline -5
   git diff --stat main..HEAD
   ```

2. **Run tests**
   ```bash
   pnpm test
   pnpm lint
   ```

3. **Check database migration status**
   ```bash
   pnpm db:migrate --dry-run
   ```

4. **Verify staging environment is healthy**
   ```bash
   curl -s https://staging-api.nexconnect.io/v1/health | jq .status
   ```

5. **Confirm no active broadcasts** — deploying during an active broadcast risks message loss.
   ```bash
   curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://staging-api.nexconnect.io/v1/broadcasts?status=RUNNING | jq '.data | length'
   ```

## Database Migration

Run migrations **before** deploying application code. Migrations must be backward-compatible (see `docs/runbooks/database-migrations.md`).

```bash
# Apply pending migrations to staging
DATABASE_URL=$STAGING_DATABASE_URL pnpm db:migrate

# Verify migration applied
DATABASE_URL=$STAGING_DATABASE_URL npx prisma migrate status --schema=prisma/schema.prisma
```

## Rolling Update — Staging

```bash
# Build and push container images
docker build -t registry.orbitmind.io/nexconnect-api:$TAG -f apps/api/Dockerfile .
docker build -t registry.orbitmind.io/nexconnect-worker:$TAG -f apps/worker/Dockerfile .
docker push registry.orbitmind.io/nexconnect-api:$TAG
docker push registry.orbitmind.io/nexconnect-worker:$TAG

# Update staging deployment
kubectl -n nexconnect-staging set image deployment/api api=registry.orbitmind.io/nexconnect-api:$TAG
kubectl -n nexconnect-staging set image deployment/worker worker=registry.orbitmind.io/nexconnect-worker:$TAG

# Watch rollout
kubectl -n nexconnect-staging rollout status deployment/api --timeout=300s
kubectl -n nexconnect-staging rollout status deployment/worker --timeout=300s
```

## Smoke Tests — Staging

```bash
# Health check
curl -s https://staging-api.nexconnect.io/v1/health | jq .

# Create test instance
curl -s -X POST https://staging-api.nexconnect.io/v1/instances \
  -H "Authorization: Bearer $TEST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "smoke-test", "connectionType": "QR_CODE"}' | jq .id

# Verify metrics endpoint
curl -s https://staging-api.nexconnect.io/metrics | head -5
```

## Production Deploy

Repeat the same steps against production after staging validation:

```bash
DATABASE_URL=$PROD_DATABASE_URL pnpm db:migrate

kubectl -n nexconnect set image deployment/api api=registry.orbitmind.io/nexconnect-api:$TAG
kubectl -n nexconnect set image deployment/worker worker=registry.orbitmind.io/nexconnect-worker:$TAG

kubectl -n nexconnect rollout status deployment/api --timeout=300s
kubectl -n nexconnect rollout status deployment/worker --timeout=300s
```

## Rollback

If smoke tests fail or error rate exceeds 1% post-deploy:

```bash
# Rollback to previous revision
kubectl -n nexconnect rollout undo deployment/api
kubectl -n nexconnect rollout undo deployment/worker

# Verify rollback
kubectl -n nexconnect rollout status deployment/api
kubectl -n nexconnect rollout status deployment/worker
```

If a database migration was applied and must be reverted, see `docs/runbooks/database-migrations.md#rollback`.

## Post-Deploy Verification

1. Check error rate in Grafana dashboard for 15 minutes
2. Verify active instance count matches pre-deploy count
3. Confirm webhook delivery success rate > 99%
4. Monitor worker pod memory usage — should stabilize below 4.5Gi per pod

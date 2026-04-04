# Secrets Rotation Runbook

## Overview

All secrets are managed via Infisical. Application pods fetch secrets at startup and cache them in memory. Rotation requires updating the secret in Infisical and restarting affected pods.

---

## API Keys (Tenant Keys)

API keys use the prefix `nc_` and are stored as bcrypt hashes in the `api_keys` table. Rotation is tenant-initiated.

1. Tenant creates a new API key via the dashboard or API:
   ```bash
   curl -X POST https://api.nexconnect.io/v1/api-keys \
     -H "Authorization: Bearer $CURRENT_KEY" \
     -d '{"name": "rotated-key", "scopes": ["instances:*", "messages:*"]}'
   ```
2. Tenant updates their integration to use the new key.
3. Tenant deactivates the old key:
   ```bash
   curl -X DELETE https://api.nexconnect.io/v1/api-keys/$OLD_KEY_ID \
     -H "Authorization: Bearer $NEW_KEY"
   ```

No pod restart required. Keys are validated against the database on every request.

---

## Encryption Keys (AES-256-GCM)

Used by `CryptoUtil` to encrypt auth state and webhook secrets. Stored as `ENCRYPTION_KEY` in Infisical.

**Rotation procedure (zero-downtime):**

1. Generate a new 256-bit key:
   ```bash
   openssl rand -hex 32
   ```

2. Update Infisical: set `ENCRYPTION_KEY` to the new value and store the old key as `ENCRYPTION_KEY_PREVIOUS`.

3. Update the application to support key rotation — `CryptoUtil` decrypts by trying the current key first, falling back to the previous key.

4. Rolling restart of all pods:
   ```bash
   kubectl -n nexconnect rollout restart deployment/api
   kubectl -n nexconnect rollout restart deployment/worker
   ```

5. Re-encrypt all stored data with the new key (background job):
   ```bash
   curl -X POST https://api.nexconnect.io/v1/admin/re-encrypt \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

6. After re-encryption completes, remove `ENCRYPTION_KEY_PREVIOUS` from Infisical.

---

## JWT Signing Keys

Used for short-lived internal service tokens (not tenant authentication).

1. Generate a new key pair:
   ```bash
   openssl ecparam -genkey -name prime256v1 -noout -out jwt-private.pem
   openssl ec -in jwt-private.pem -pubout -out jwt-public.pem
   ```

2. Update `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` in Infisical.

3. Rolling restart:
   ```bash
   kubectl -n nexconnect rollout restart deployment/api
   ```

4. Existing tokens signed with the old key will expire naturally (15-minute TTL). No manual revocation needed.

---

## R2 Credentials (Cloudflare)

Used for media upload/download (audio, images, documents).

1. Generate new R2 API token in the Cloudflare dashboard with the same permissions (Object Read & Write on the `nexconnect-media` bucket).

2. Update in Infisical:
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`

3. Rolling restart of worker pods (workers handle media upload):
   ```bash
   kubectl -n nexconnect rollout restart deployment/worker
   ```

4. Verify media upload works:
   ```bash
   curl -X POST https://api.nexconnect.io/v1/instances/$INSTANCE_ID/messages \
     -H "Authorization: Bearer $API_KEY" \
     -F 'to=+5511999999999' -F 'type=image' -F 'file=@test.png'
   ```

5. Revoke the old R2 token in the Cloudflare dashboard after confirming all pods are using the new credentials.

---

## Infisical Service Tokens

Pods authenticate to Infisical using service tokens to fetch secrets.

1. Create a new service token in the Infisical dashboard with the same project and environment scope.

2. Update the Kubernetes secret:
   ```bash
   kubectl -n nexconnect create secret generic infisical-token \
     --from-literal=INFISICAL_TOKEN=$NEW_TOKEN \
     --dry-run=client -o yaml | kubectl apply -f -
   ```

3. Rolling restart all deployments:
   ```bash
   kubectl -n nexconnect rollout restart deployment/api
   kubectl -n nexconnect rollout restart deployment/worker
   ```

4. Revoke the old service token in the Infisical dashboard.

---

## Redis Password

1. Update the password in Redis configuration (Sentinel or standalone):
   ```bash
   kubectl -n nexconnect exec -it redis-0 -- redis-cli CONFIG SET requirepass "$NEW_PASSWORD"
   ```

2. Update `REDIS_PASSWORD` in Infisical.

3. Rolling restart all pods that connect to Redis:
   ```bash
   kubectl -n nexconnect rollout restart deployment/api
   kubectl -n nexconnect rollout restart deployment/worker
   ```

4. Verify connectivity:
   ```bash
   kubectl -n nexconnect exec -it redis-0 -- redis-cli -a "$NEW_PASSWORD" PING
   ```

---

## Rotation Schedule

| Secret | Rotation Frequency | Owner |
|---|---|---|
| Tenant API keys | Tenant-managed, recommended 90 days | Tenant |
| Encryption keys | Every 6 months | Platform team |
| JWT signing keys | Every 3 months | Platform team |
| R2 credentials | Every 6 months | Platform team |
| Infisical tokens | Every 3 months | Platform team |
| Redis password | Every 6 months | Platform team |
| Database password | Every 6 months | Platform team |

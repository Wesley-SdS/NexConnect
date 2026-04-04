# Incident Response Runbook

## Severity Levels

| Level | Description | Response Time | Examples |
|---|---|---|---|
| **SEV-1** | Total service outage | 15 minutes | All instances disconnected, API unreachable |
| **SEV-2** | Partial degradation | 30 minutes | >10% instances disconnected, webhook delivery backlog |
| **SEV-3** | Minor issue | 2 hours | Single instance failure, elevated error rate <1% |

---

## Playbook: Instance Disconnected

**Symptoms:** Instance status changed to `DISCONNECTED`, webhook `instance.disconnected` fired.

**Diagnosis:**
```bash
# Check instance status in database
psql $DATABASE_URL -c "SELECT id, name, status, health_score, pod_id FROM instances WHERE id = '$INSTANCE_ID';"

# Check worker pod logs
kubectl -n nexconnect logs -l app=worker --all-containers | grep "$INSTANCE_ID" | tail -20

# Check if pod is still running
kubectl -n nexconnect get pod $(psql $DATABASE_URL -t -c "SELECT pod_id FROM instances WHERE id = '$INSTANCE_ID';")
```

**Resolution:**
1. If pod is running — trigger reconnection via API:
   ```bash
   curl -X POST https://api.nexconnect.io/v1/instances/$INSTANCE_ID/connect \
     -H "Authorization: Bearer $API_KEY"
   ```
2. If pod is dead — instance will be reassigned on next scheduler cycle (60s). Verify reassignment:
   ```bash
   kubectl -n nexconnect logs -l app=api | grep "reassign" | grep "$INSTANCE_ID"
   ```
3. If health score < 30 — check for WhatsApp ban. Review `number_health` table:
   ```bash
   psql $DATABASE_URL -c "SELECT * FROM number_health WHERE instance_id = '$INSTANCE_ID';"
   ```

---

## Playbook: Webhook Dead Letters

**Symptoms:** `webhook_deliveries` with `status = 'DEAD_LETTER'` increasing. Alert fires when dead letter count exceeds 100 in 5 minutes.

**Diagnosis:**
```bash
# Count dead letters per webhook
psql $DATABASE_URL -c "
  SELECT w.url, COUNT(*) as dead_letters
  FROM webhook_deliveries wd
  JOIN webhooks w ON w.id = wd.webhook_id
  WHERE wd.status = 'DEAD_LETTER' AND wd.created_at > NOW() - INTERVAL '1 hour'
  GROUP BY w.url ORDER BY dead_letters DESC LIMIT 10;
"

# Check last delivery error
psql $DATABASE_URL -c "
  SELECT response_code, response_body, duration_ms
  FROM webhook_deliveries
  WHERE status = 'DEAD_LETTER'
  ORDER BY created_at DESC LIMIT 5;
"
```

**Resolution:**
1. If target server is down (response_code = NULL or 5xx) — contact the tenant to verify their endpoint
2. If response_code = 401/403 — webhook secret may have rotated; tenant must update their verification logic
3. If duration_ms >= 10000 — target server is timing out; advise tenant to optimize their endpoint (must respond within 10s)
4. Replay dead letters after resolution:
   ```bash
   curl -X POST https://api.nexconnect.io/v1/webhooks/$WEBHOOK_ID/replay \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"status": "DEAD_LETTER", "fromDate": "2026-03-30T00:00:00Z"}'
   ```

---

## Playbook: Health Score Critical (< 30)

**Symptoms:** Instance health score drops below `HEALTH_SCORE_CRITICAL_THRESHOLD` (30). Indicates potential WhatsApp ban or severe delivery issues.

**Diagnosis:**
```bash
# Get health breakdown
psql $DATABASE_URL -c "
  SELECT score, response_rate, read_rate, bounce_rate, volume_score, calculated_at
  FROM number_health WHERE instance_id = '$INSTANCE_ID';
"

# Check recent message failure rate
psql $DATABASE_URL -c "
  SELECT status, COUNT(*) FROM messages
  WHERE instance_id = '$INSTANCE_ID' AND created_at > NOW() - INTERVAL '1 hour'
  GROUP BY status;
"
```

**Resolution:**
1. If bounce_rate > 0.5 — number is likely flagged. Pause outbound messages immediately:
   ```bash
   curl -X PATCH https://api.nexconnect.io/v1/instances/$INSTANCE_ID \
     -H "Authorization: Bearer $API_KEY" \
     -d '{"settings": {"sendingPaused": true}}'
   ```
2. Reduce send volume gradually over 24-48 hours
3. If `status = BANNED` — number is permanently banned. Notify tenant. No recovery possible.

---

## Playbook: Pod CrashLoop

**Symptoms:** Worker pod in `CrashLoopBackOff` state. Instances on that pod are disconnected.

**Diagnosis:**
```bash
# Get pod status and restart count
kubectl -n nexconnect get pods -l app=worker | grep CrashLoop

# Check last crash reason
kubectl -n nexconnect describe pod $POD_NAME | grep -A5 "Last State"

# Check OOMKill
kubectl -n nexconnect get pod $POD_NAME -o jsonpath='{.status.containerStatuses[0].lastState.terminated.reason}'

# Get logs from previous crash
kubectl -n nexconnect logs $POD_NAME --previous --tail=50
```

**Resolution:**
1. If OOMKilled — pod exceeded 6Gi memory limit. Check instance count on that pod:
   ```bash
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM instances WHERE pod_id = '$POD_NAME' AND status != 'DISCONNECTED';"
   ```
   If count > 30, there is a scheduling bug. Manually redistribute instances.

2. If application error — check logs for stack trace. Common causes:
   - Prisma connection pool exhaustion: increase `connection_limit` in DATABASE_URL
   - Redis connection refused: verify Redis pod is healthy
   - Unhandled Baileys exception: check for protocol changes

3. Instances on the crashed pod will be auto-reassigned after 60s by the scheduler.

---

## Playbook: Redis Out of Memory

**Symptoms:** Redis returns OOM errors. BullMQ jobs fail to enqueue. Instance status cache returns stale data.

**Diagnosis:**
```bash
# Check Redis memory usage
kubectl -n nexconnect exec -it redis-0 -- redis-cli INFO memory | grep used_memory_human

# Check key count by prefix
kubectl -n nexconnect exec -it redis-0 -- redis-cli --scan --pattern "bull:*" | wc -l
kubectl -n nexconnect exec -it redis-0 -- redis-cli --scan --pattern "instance:*" | wc -l
kubectl -n nexconnect exec -it redis-0 -- redis-cli --scan --pattern "buffer:*" | wc -l
```

**Resolution:**
1. Clear completed/failed BullMQ jobs older than 24h:
   ```bash
   kubectl -n nexconnect exec -it redis-0 -- redis-cli EVAL "
     local keys = redis.call('keys', 'bull:*:completed')
     for _,k in ipairs(keys) do redis.call('ltrim', k, 0, 999) end
     return #keys
   " 0
   ```
2. Check for orphaned dedup keys:
   ```bash
   kubectl -n nexconnect exec -it redis-0 -- redis-cli --scan --pattern "dedup:*" | wc -l
   ```
   Dedup keys have 3600s TTL. If count is abnormally high, there may be a TTL bug.

3. If memory is still critical, increase `maxmemory` in Redis config or scale to Redis Cluster.

4. Long-term: configure BullMQ `removeOnComplete` and `removeOnFail` with TTL to auto-purge old jobs.

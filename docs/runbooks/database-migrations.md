# Database Migrations Runbook

## Creating a Migration

1. Modify `prisma/schema.prisma` with the desired changes.

2. Generate the migration SQL without applying it:
   ```bash
   pnpm db:migrate --name descriptive_name --create-only
   ```

3. Review the generated SQL in `prisma/migrations/<timestamp>_descriptive_name/migration.sql`.

4. If you need custom SQL (RLS policies, indexes, triggers), add it to the migration file before applying.

## Testing Locally

```bash
# Reset local database and apply all migrations from scratch
DATABASE_URL="postgresql://nexconnect:nexconnect@localhost:5432/nexconnect_test" \
  npx prisma migrate reset --schema=prisma/schema.prisma --force

# Verify schema matches expected state
DATABASE_URL="postgresql://nexconnect:nexconnect@localhost:5432/nexconnect_test" \
  npx prisma migrate status --schema=prisma/schema.prisma
```

## Applying to Staging

Migrations run **before** application deployment to ensure the new schema is available when new code starts.

```bash
# Check pending migrations
DATABASE_URL=$STAGING_DATABASE_URL npx prisma migrate status --schema=prisma/schema.prisma

# Apply pending migrations
DATABASE_URL=$STAGING_DATABASE_URL npx prisma migrate deploy --schema=prisma/schema.prisma

# Regenerate Prisma Client
pnpm db:generate
```

## Applying to Production

1. **Create a database backup** before migrating:
   ```bash
   pg_dump $PROD_DATABASE_URL --format=custom --file=backup_$(date +%Y%m%d_%H%M%S).dump
   ```

2. **Apply the migration** during a maintenance window if it involves table locks (ALTER TABLE, CREATE INDEX):
   ```bash
   DATABASE_URL=$PROD_DATABASE_URL npx prisma migrate deploy --schema=prisma/schema.prisma
   ```

3. **Verify** the migration applied successfully:
   ```bash
   DATABASE_URL=$PROD_DATABASE_URL npx prisma migrate status --schema=prisma/schema.prisma
   ```

## Rollback

Prisma does not have built-in rollback. Rollbacks must be done manually.

### Option A: Revert with a new migration

Create a new migration that undoes the changes:
```bash
# Write the reverse SQL manually
pnpm db:migrate --name revert_descriptive_name --create-only
# Edit the generated migration file with the reverse operations
# Apply it
DATABASE_URL=$TARGET_DATABASE_URL npx prisma migrate deploy --schema=prisma/schema.prisma
```

### Option B: Restore from backup

For destructive migrations (column drops, table drops):
```bash
# Restore the backup
pg_restore --clean --if-exists -d $PROD_DATABASE_URL backup_20260330_120000.dump

# Mark reverted migrations as rolled back
DATABASE_URL=$PROD_DATABASE_URL npx prisma migrate resolve --rolled-back <migration_name> --schema=prisma/schema.prisma
```

## Migration Safety Rules

1. **Never drop columns in the same deploy** as the code change that stops using them. Use a two-phase approach:
   - Deploy 1: Stop reading/writing the column in code
   - Deploy 2: Drop the column in a migration

2. **Add columns as nullable** or with a default value. `NOT NULL` without a default locks the table for a full rewrite on large tables.

3. **Create indexes concurrently** for tables with >1M rows:
   ```sql
   CREATE INDEX CONCURRENTLY idx_name ON table_name (column);
   ```
   Note: `CREATE INDEX CONCURRENTLY` cannot run inside a transaction. Add it as a separate migration step.

4. **Never rename columns directly.** Instead: add new column, backfill, update code, drop old column.

5. **Test migrations against a production-size dataset** before applying to production. Use a staging database restored from a production backup.

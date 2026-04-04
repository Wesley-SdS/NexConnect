FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/worker/package.json ./apps/worker/
COPY libs/core/package.json ./libs/core/
COPY libs/database/package.json ./libs/database/
COPY libs/redis/package.json ./libs/redis/
COPY libs/shared/package.json ./libs/shared/
RUN pnpm install --frozen-lockfile --prod=false

# ── Build ─────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY tsconfig.base.json ./
COPY libs ./libs
COPY apps/worker ./apps/worker
COPY prisma ./prisma
RUN pnpm --filter @nexconnect/database prisma:generate
RUN pnpm --filter @nexconnect/worker build

# ── Production ────────────────────────────────────────────────
FROM node:22-alpine AS production
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nexconnect && \
    adduser -S nexconnect -u 1001

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/worker/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

USER nexconnect

CMD ["node", "dist/main.js"]

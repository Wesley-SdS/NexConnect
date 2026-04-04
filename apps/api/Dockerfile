# ---- Base ----
FROM node:22-alpine AS base

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./

COPY apps/api/package.json apps/api/
COPY libs/core/package.json libs/core/
COPY libs/database/package.json libs/database/
COPY libs/redis/package.json libs/redis/
COPY libs/shared/package.json libs/shared/

RUN pnpm install --frozen-lockfile

COPY libs/ libs/
COPY apps/api/ apps/api/

# ---- Development ----
FROM base AS development

ENV NODE_ENV=development

CMD ["pnpm", "--filter", "@nexconnect/api", "dev"]

# ---- Build ----
FROM base AS build

RUN pnpm --filter @nexconnect/api build

# ---- Production ----
FROM node:22-alpine AS production

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/libs/core/package.json libs/core/
COPY --from=build /app/libs/database/package.json libs/database/
COPY --from=build /app/libs/redis/package.json libs/redis/
COPY --from=build /app/libs/shared/package.json libs/shared/

RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/libs/ libs/

EXPOSE 3000

USER node

CMD ["node", "apps/api/dist/main.js"]

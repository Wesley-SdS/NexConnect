#!/bin/bash
set -e

echo "=== NexConnect Setup ==="
echo ""

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js is required. Install v22+"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm is required. Run: corepack enable && corepack prepare pnpm@9 --activate"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required."; exit 1; }

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
  echo "Node.js 22+ required. Current: $(node -v)"
  exit 1
fi

echo "[1/6] Installing dependencies..."
pnpm install

echo "[2/6] Setting up environment..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  .env created from .env.example"
  echo "  Please update .env with your credentials"
else
  echo "  .env already exists, skipping"
fi

echo "[3/6] Starting infrastructure..."
docker compose up -d postgres redis

echo "[4/6] Waiting for PostgreSQL..."
until docker compose exec -T postgres pg_isready -U nexconnect > /dev/null 2>&1; do
  sleep 1
done
echo "  PostgreSQL is ready"

echo "[5/6] Generating Prisma client..."
pnpm db:generate

echo "[6/6] Running database migrations..."
pnpm db:migrate

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Start development:"
echo "  pnpm dev:api      # API on port 3100"
echo "  pnpm dev:worker   # Worker"
echo ""
echo "Run tests:"
echo "  pnpm test"
echo ""

# Deploying PlanForge

## Quick Deploy with Docker Compose (VPS / Self-hosted)

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env with production values (generate secrets, set DATABASE_URL, etc.)

# 2. Start everything
docker compose up -d

# App will be at http://localhost:3000
# API will be at http://localhost:3001
```

## Deploy to Fly.io

### Prerequisites
```bash
brew install flyctl
fly auth login
```

### 1. Create a Postgres database
```bash
fly postgres create --name planforge-db --region sjc
```

### 2. Deploy the API
```bash
cd apps/api

# Create the app (first time only)
fly launch --no-deploy

# Attach the database
fly postgres attach planforge-db

# Set secrets
fly secrets set \
  JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" \
  ENCRYPTION_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" \
  ANTHROPIC_API_KEY="your-key" \
  CORS_ORIGIN="https://planforge-web.fly.dev" \
  APP_URL="https://planforge-web.fly.dev"

# Deploy (from repo root for Docker context)
cd ../..
fly deploy --config apps/api/fly.toml
```

### 3. Deploy the Web frontend
```bash
cd apps/web

# Create the app (first time only)
fly launch --no-deploy

# Set the API URL (build-time env var for Next.js)
fly secrets set NEXT_PUBLIC_API_URL="https://planforge-api.fly.dev"

# Deploy (from repo root for Docker context)
cd ../..
fly deploy --config apps/web/fly.toml --build-arg NEXT_PUBLIC_API_URL=https://planforge-api.fly.dev
```

### 4. Run database migrations
```bash
fly ssh console --app planforge-api -C "npx prisma migrate deploy --schema=../../prisma/schema.prisma"
```

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | 64-char hex secret for JWT signing |
| `ENCRYPTION_KEY` | Yes | 64-char hex secret for AES-256-GCM encryption |
| `API_PORT` | No | API server port (default: 3001) |
| `CORS_ORIGIN` | Yes | Allowed CORS origins (comma-separated) |
| `APP_URL` | Yes | Frontend URL (used in invitation emails) |
| `NEXT_PUBLIC_API_URL` | Yes | API URL for the frontend |
| `ANTHROPIC_API_KEY` | No | Enables bundled LLM credits for evals/playground |
| `LS_STORE_ID` | No | Lemon Squeezy store slug |
| `LS_WEBHOOK_SECRET` | No | Lemon Squeezy webhook secret |
| `LS_VARIANT_PRO` | No | Lemon Squeezy variant ID for Pro plan |
| `LS_VARIANT_TEAM` | No | Lemon Squeezy variant ID for Team plan |

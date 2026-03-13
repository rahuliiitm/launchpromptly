# ── Stage 1: Install dependencies ──
FROM node:20-alpine AS deps
WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json turbo.json ./

# Copy ALL workspace package.json files (lockfile expects complete workspace)
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/calculators/package.json packages/calculators/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/

RUN npm ci

# ── Stage 2: Build ──
FROM node:20-alpine AS builder
WORKDIR /app

# Copy ALL node_modules (root + workspace-specific)
COPY --from=deps /app ./

# Now overlay the full source (node_modules excluded by .dockerignore)
COPY . .

# Accept API URL as build arg (baked into Next.js at build time)
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

# Build shared packages + Web
RUN npx turbo run build --filter=@launchpromptly/web...

# ── Stage 3: Production ──
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy Next.js standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]

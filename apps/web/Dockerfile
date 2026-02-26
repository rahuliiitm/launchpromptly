# ── Stage 1: Install dependencies ──
FROM node:20-alpine AS deps
WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json turbo.json ./

# Copy all workspace package.json files
COPY apps/web/package.json apps/web/
COPY packages/calculators/package.json packages/calculators/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/

RUN npm ci

# ── Stage 2: Build ──
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build shared packages + Web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx turbo run build --filter=@aiecon/web...

# ── Stage 3: Production ──
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy Next.js standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]

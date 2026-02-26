# ── Stage 1: Install dependencies ──
FROM node:20-alpine AS deps
WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json turbo.json ./
COPY prisma ./prisma/

# Copy all workspace package.json files
COPY apps/api/package.json apps/api/
COPY packages/calculators/package.json packages/calculators/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/

RUN npm ci

# ── Stage 2: Build ──
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate --schema=prisma/schema.prisma

# Build shared packages + API
RUN npx turbo run build --filter=@launchpromptly/api...

# ── Stage 3: Production ──
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

EXPOSE 3001

WORKDIR /app/apps/api

CMD ["sh", "-c", "npx prisma migrate deploy --schema=../../prisma/schema.prisma && node dist/main"]

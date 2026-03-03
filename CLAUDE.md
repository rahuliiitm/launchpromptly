# CLAUDE.md — LaunchPromptly Development Guide

> **Reusable playbook for building SaaS products from idea to deployment.**
> Written from real experience building LaunchPromptly. Apply these patterns to any new project.

---

## Product Identity

**LaunchPromptly** — Runtime Safety Layer for LLM Applications.
Drop-in SDK (Node + Python) that adds PII redaction, prompt injection detection, cost controls, content filtering, and streaming guard to any LLM app. Client-side, zero dependencies.

**Positioning:** "Secure your LLM apps in 2 lines of code."

---

## 1. Idea-to-Deployment Playbook

### Phase 1: Validate Before Building
- Start with the smallest possible scope. LaunchPromptly tried to be 3 products (prompt management, observability, runtime safety) and lost to funded competitors on the first two.
- **Rule: Pick ONE thing you can own. Delete the rest.**
- Validate with a spreadsheet: "If a company is tracking this in Google Sheets, you can build a product."
- Talk to 5 potential users before writing code. Ask "what sucks about how you do X today?"

### Phase 2: Architecture Decisions (Make Once)
Decide these upfront — changing them later is expensive:

| Decision | Our Choice | Why |
|----------|-----------|-----|
| Monorepo vs polyrepo | Monorepo (Turbo) for platform, separate repos for SDKs | Platform shares types/utils; SDKs have independent release cycles |
| API framework | NestJS | Modules/guards/pipes for structured enterprise code |
| Frontend | Next.js 14 App Router | SSR for landing, client components for dashboard |
| Database | PostgreSQL + Prisma | Type-safe ORM, migrations, no NoSQL complexity |
| Auth | JWT (7d) + bcrypt API keys | Simple, stateless, no session store needed |
| Billing | Lemon Squeezy | No Stripe complexity for early stage |
| Deployment | Docker + GCP Cloud Run | Scales to zero, cheap, no Kubernetes overhead |
| Styling | Tailwind CSS (no UI library) | Fast iteration, no component library lock-in |

### Phase 3: Build the Core Loop First
Build the smallest loop that delivers value:
1. User signs up → gets API key
2. User installs SDK → wraps their LLM client
3. SDK does the thing (security scanning, whatever your product does)
4. Dashboard shows results

Everything else (teams, billing, RBAC, compliance) comes AFTER this loop works.

### Phase 4: Pricing Strategy
- **Usage-based, not seat-based** — "we share your success"
- 3 tiers: Indie ($29), Startup ($79), Growth ($199)
- Free trial, no credit card upfront
- Differentiate tiers by FEATURES + VOLUME, not by crippling lower tiers
- Current tier breakdown:
  - **Indie**: Core guardrails (PII, injection, cost guard), 10K events/mo
  - **Startup**: + Streaming guard, content filtering, schema validation, 100K events/mo
  - **Growth**: + ML-enhanced detection, unlimited events, priority support

### Phase 5: Deploy Early, Iterate Fast
- Docker Compose for local dev (PostgreSQL + API + Web)
- GCP Cloud Run for production (scales to zero = cheap)
- GitHub Actions CI: test → build → deploy on merge to main
- Database migrations via Prisma (`prisma migrate deploy` in Cloud Run startup)

---

## 2. Project Structure

```
plan-forge/                          # Monorepo root
├── apps/
│   ├── api/                         # NestJS backend (port 3001)
│   │   ├── src/
│   │   │   ├── auth/                # JWT + API key auth
│   │   │   ├── project/             # Project + API key CRUD
│   │   │   ├── events/              # LLM event ingestion
│   │   │   ├── security-analytics/  # Security metrics dashboard
│   │   │   ├── security-policy/     # Policy CRUD
│   │   │   ├── audit/               # Audit log
│   │   │   ├── alert/               # Alert rules
│   │   │   ├── billing/             # Lemon Squeezy integration
│   │   │   ├── environment/         # API key scoping
│   │   │   ├── invitation/          # Team invitations
│   │   │   ├── crypto/              # AES-256-GCM encryption
│   │   │   ├── prisma/              # DB connection
│   │   │   ├── common/              # Middleware, filters
│   │   │   └── config/              # Env validation
│   │   └── Dockerfile
│   └── web/                         # Next.js 14 frontend (port 3000)
│       ├── app/
│       │   ├── page.tsx             # Landing + dashboard
│       │   ├── login/               # Auth
│       │   └── admin/               # Security, SDK, API keys
│       ├── src/lib/                  # Auth context, API client
│       └── Dockerfile
├── packages/
│   ├── types/                       # Shared TypeScript types
│   ├── calculators/                 # Cost calculations
│   └── utils/                       # Shared utilities
├── prisma/                          # Schema + migrations
├── e2e/                             # Playwright E2E tests
└── turbo.json                       # Build orchestration
```

**SDK Repositories (separate):**
- `/Users/rjain/side-projects/node-sdk` — TypeScript SDK
- `/Users/rjain/side-projects/python-sdk` — Python SDK

---

## 3. Development Commands

```bash
# ── Setup ──
npm install
npm run db:migrate                   # Apply Prisma migrations
npm run db:generate                  # Regenerate Prisma client

# ── Development ──
npm run dev                          # All services in watch mode

# ── Testing ──
npm run test                         # Unit tests (Jest)
npm run test:e2e                     # E2E tests (Playwright)

# ── Build ──
npm run typecheck                    # TypeScript check
npm run build                        # Full monorepo build (Turbo)

# ── Database ──
npx prisma migrate dev --name <name> # New migration
npx prisma studio                    # Visual DB browser

# ── Docker ──
docker compose up -d                 # Local with PostgreSQL
docker compose down

# ── SDK Testing ──
cd /Users/rjain/side-projects/node-sdk && npm test
cd /Users/rjain/side-projects/python-sdk && .venv/bin/python -m pytest
```

### Turbo Filter Syntax
```bash
npx turbo build --filter=@launchpromptly/api   # API only
npx turbo build --filter=@launchpromptly/web   # Web only
```

---

## 4. Tech Stack Reference

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js (App Router) | 14.2 |
| Backend | NestJS | 10.4 |
| Database | PostgreSQL + Prisma | PG 16, Prisma 6.0 |
| Auth | JWT + Passport + bcrypt | 7d token expiry |
| Encryption | AES-256-GCM (Node crypto) | — |
| Build | Turbo | 2.3+ |
| Styling | Tailwind CSS | 3.4 |
| Charts | Recharts | 3.7 |
| Testing | Jest (unit), Playwright (E2E) | Jest 29, PW 1.58 |
| Deploy | Docker + GCP Cloud Run | — |
| Billing | Lemon Squeezy | — |
| CI/CD | GitHub Actions | — |
| Node SDK | TypeScript | 0.1.0 |
| Python SDK | Python 3.10+ | 0.1.0 |

---

## 5. Architecture Patterns

### Authentication Flow
1. Register → creates User + Organization + Project + default Environments (prod/dev)
2. Login → returns JWT (7d expiry)
3. Dashboard routes: `@UseGuards(JwtAuthGuard)` + `@Req() req: AuthenticatedRequest`
4. SDK clients: API keys (bcrypt-hashed, stored as `keyHash` + `keyPrefix`)

### NestJS Module Pattern
Every domain is a self-contained module:
```
feature/
├── feature.module.ts       # @Module({ imports, controllers, providers, exports })
├── feature.controller.ts   # Route handlers, @UseGuards, DTOs
├── feature.service.ts      # Business logic, Prisma queries
├── feature.service.spec.ts # Unit tests
└── dto/                    # class-validator DTOs
```

### API Security Layers
1. **Rate Limiting**: Throttler (20 req/s, 200 req/min per IP)
2. **Validation**: Global ValidationPipe (whitelist, forbidNonWhitelisted, transform)
3. **Auth**: JWT guard or API key guard per route
4. **Encryption**: AES-256-GCM for sensitive data at rest
5. **Audit**: Every security-relevant action logged

### SDK Guardrail Pipeline (execution order)
```
User calls openai.chat.completions.create(...)
  1. Model Policy Check      → block disallowed models/params
  2. Cost Guard Pre-Check    → block if budget exceeded
  3. PII Detection (input)   → detect emails, SSNs, etc.
  4. PII Redaction (input)   → placeholder/mask/hash/random
  5. Injection Detection      → score risk, block if high
  6. Content Filter (input)   → hate, violence, etc.
  7. >>> LLM API Call >>>
  8. Content Filter (output)  → scan response
  9. Schema Validation        → enforce JSON structure
  10. PII Detection (output)  → scan response for leaks
  11. Cost Guard Record       → track actual cost
  12. Event Batching          → report to dashboard
  13. Guardrail Events        → fire registered callbacks
```

For streaming, StreamGuardEngine wraps steps 7-10 with mid-stream scanning.

### SDK Provider Pattern
Three providers, each wrapping a different LLM client:
- **OpenAI**: Wraps `openai.chat.completions.create()` — main path in `launch-promptly.ts` / `client.py`
- **Anthropic**: Wraps `anthropic.messages.create()` — separate module in `providers/anthropic.ts`
- **Gemini**: Wraps `google.generativeai` — separate module in `providers/gemini.ts`

Each provider runs the same pipeline. Node providers receive `deps` (with `emit` function). Python providers receive `lp` (LaunchPromptly instance) directly.

---

## 6. Environment Variables

```bash
# Required
DATABASE_URL="postgresql://user:pass@localhost:5433/dbname?schema=public"
JWT_SECRET="<random-32-byte-hex>"
ENCRYPTION_KEY="<64-char-hex-string>"    # AES-256-GCM key
API_PORT=3001

# Frontend
NEXT_PUBLIC_API_URL="http://localhost:3001"

# Billing (Lemon Squeezy — optional for dev)
LS_STORE_ID=""
LS_WEBHOOK_SECRET=""
LS_VARIANT_PRO=""
LS_VARIANT_TEAM=""

# LLM Provider (optional — for features that call LLMs)
ANTHROPIC_API_KEY=""
```

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 7. Database Schema (Key Models)

| Model | Purpose |
|-------|---------|
| User | Auth, org membership, role (admin/member) |
| Organization | Multi-tenant container, billing plan |
| Project | API keys, events, policies, alerts |
| Environment | API key scoping (prod/dev) |
| ApiKey | SDK auth (bcrypt hash, prefix, expiry) |
| LLMEvent | Event ingestion with encrypted fields |
| SecurityPolicy | Guardrail rules (JSON) |
| AlertRule | Webhook/email triggers on guardrail events |
| AuditLog | Searchable guardrail decision log |
| Invitation | Org user onboarding |

### Migration Workflow
```bash
# Edit prisma/schema.prisma, then:
npx prisma migrate dev --name descriptive_name
# For production:
npx prisma migrate deploy
```

---

## 8. Testing Strategy

### Unit Tests (Jest)
- Colocated with source: `feature.service.spec.ts`
- Mock Prisma with `jest.fn()` for DB operations
- Test business logic in services, not controllers
- SDK tests: mock LLM client responses, verify pipeline behavior

### E2E Tests (Playwright)
- In `e2e/` directory
- Test full user flows: signup → API key → SDK usage → dashboard
- Run against actual API + Web (not mocked)

### SDK Tests
- **Node**: Jest — `cd node-sdk && npm test` (346+ tests)
- **Python**: pytest — `cd python-sdk && .venv/bin/python -m pytest` (375+ tests)
- Both SDKs mirror the same test suites

### What to Test
- Every guardrail: PII patterns, injection heuristics, cost limits, content categories
- Provider wrappers: OpenAI, Anthropic, Gemini (mock the API client)
- Streaming: cross-chunk detection, abort, length limits
- Edge cases: empty input, unicode, concurrent requests

---

## 9. Deployment

### Local (Docker Compose)
```bash
docker compose up -d    # PostgreSQL + API + Web
```

### Production (GCP Cloud Run)
- Merge to `main` triggers GitHub Actions → Cloud Build → Cloud Run
- API: 512Mi memory, auto-scaling
- Web: 256Mi memory, auto-scaling
- Database: Cloud SQL PostgreSQL 16 (`db-f1-micro` for early stage)
- Migrations run as Cloud Job on deploy

### Docker Build Pattern
Multi-stage: `deps` → `builder` → `runner` (only dist + node_modules copied)

---

## 10. Development Best Practices (Lessons Learned)

### Code Organization
- **One module per domain.** Don't let services grow beyond ~300 lines.
- **DTOs validate at the boundary.** Use class-validator on every POST/PATCH endpoint.
- **Never store secrets in plaintext.** API keys → bcrypt hash. Provider keys → AES-256-GCM.
- **Colocate tests with source.** `feature.service.spec.ts` next to `feature.service.ts`.

### Build Hygiene
- **Set `outDir: "dist"` in every tsconfig.** Without it, `.js` and `.d.ts` files pollute `src/`.
- **Add generated file patterns to .gitignore.** Even with `outDir`, IDEs and accidental `tsc` runs create junk.
- **Clean build artifacts before testing.** `rm -rf dist .next .turbo` then `npx turbo build`.
- **Use Turbo filter syntax** for targeted builds: `--filter=@launchpromptly/api`.

### SDK Development (Dual SDK Pattern)
- **Build Node SDK first, then port to Python.** TypeScript catches type errors early.
- **Mirror test suites exactly.** Same test names, same assertions, same edge cases.
- **Provider wrappers need `emit` for events.** Node: pass via `deps` object. Python: pass `lp` instance.
- **Zero-dependency principle.** Core SDK uses regex only. ML features are optional extras.
- **Run both SDK test suites after every change.** One SDK breaking silently is easy to miss.

### Frontend Patterns
- **`'use client'` on every page.** Next.js App Router defaults to server components.
- **Auth context wraps the entire app.** `AuthProvider` in `client-layout.tsx`.
- **`apiFetch()` wrapper for all API calls.** Handles auth headers, error formatting, connection errors.
- **Spinners everywhere loading state exists.** Users hate blank screens.

### Pivot & Refactoring
- **Delete, don't hide.** When removing features, delete the code entirely. No feature flags, no commented-out code.
- **Extract before deleting.** If module A depends on module B and you're deleting B, extract what A needs first (e.g., SecurityAnalyticsService from AnalyticsModule).
- **Run full build after every deletion phase.** Broken imports surface immediately.
- **Update all copy.** Stale marketing text ("Manage your AI prompts") after a pivot is worse than no text.

### Billing & Pricing
- **Start with Lemon Squeezy, not Stripe.** Simpler integration, good enough for $0-$100K ARR.
- **Usage-based, not seat-based.** Aligns incentives — you grow when they grow.
- **3 tiers max.** Decision paralysis kills conversions.
- **Free trial, no credit card.** Remove all friction from first experience.

### Common Pitfalls (Avoid These)
- Don't build teams/RBAC before you have 10 paying users
- Don't build compliance/GDPR before you have enterprise customers asking
- Don't build ML features before regex-based features are solid
- Don't build a custom billing system — use Lemon Squeezy or Stripe
- Don't add observability/tracing as a feature — focus on what you do best
- Don't compete with well-funded players on their turf — find your moat

---

## 11. Git Workflow

### Commit Convention
```
feat: description    # New feature
fix: description     # Bug fix
chore: description   # Maintenance
refactor: description # Code restructuring
test: description    # Test additions
```

### Branch Strategy
- `master` — active development
- `main` — production (merge triggers deploy)
- Feature branches for large changes

### Pre-commit Checks
```bash
npm run typecheck && npm run test && npm run build
```

---

## 12. Debugging Checklist

| Symptom | Check |
|---------|-------|
| Login page blank | Is the API running on port 3001? Auth context calls `/auth/me` on mount |
| CORS errors | Check `CORS_ORIGIN` in API env, `enableCors()` in main.ts |
| API 500 errors | Check Prisma schema matches DB (run `prisma migrate dev`) |
| SDK events not appearing | Check API key is valid, check `NEXT_PUBLIC_API_URL` matches API |
| Build fails with type errors | Run `npm run db:generate` (Prisma client may be stale) |
| `.js` files in `src/` | Delete them — they're build artifacts from stale `tsc` runs |
| Port already in use | `lsof -ti:PORT \| xargs kill` |
| Docker build fails | Check multi-stage build copies all workspace package.json files |

---

## 13. Quick Reference

| Item | Value |
|------|-------|
| API URL (local) | http://localhost:3001 |
| Web URL (local) | http://localhost:3000 |
| DB URL (local) | postgresql://...@localhost:5433 |
| API health check | GET /health |
| Package names | @launchpromptly/api, @launchpromptly/web |
| Node SDK | launchpromptly (npm) |
| Python SDK | launchpromptly (pip) |
| Node version | >=20 |
| Python version | >=3.10 |

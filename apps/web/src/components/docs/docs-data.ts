// ── Section definitions for TOC ───────────────────────────────────────────────

export const SECTIONS = [
  { id: 'installation', label: 'Installation', depth: 1 },
  { id: 'constructor', label: 'Constructor Options', depth: 1 },
  { id: 'wrap-options', label: 'Wrap Options', depth: 1 },
  { id: 'security', label: 'Security Configuration', depth: 1 },
  { id: 'pii', label: 'PII Detection & Redaction', depth: 2 },
  { id: 'injection', label: 'Injection Detection', depth: 2 },
  { id: 'cost-guard', label: 'Cost Guard', depth: 2 },
  { id: 'content-filter', label: 'Content Filter', depth: 2 },
  { id: 'model-policy', label: 'Model Policy', depth: 2 },
  { id: 'output-schema', label: 'Output Schema Validation', depth: 2 },
  { id: 'stream-guard', label: 'Stream Guard', depth: 2 },
  { id: 'audit', label: 'Audit', depth: 2 },
  { id: 'providers', label: 'Provider Wrappers', depth: 1 },
  { id: 'provider-openai', label: 'OpenAI', depth: 2 },
  { id: 'provider-anthropic', label: 'Anthropic', depth: 2 },
  { id: 'provider-gemini', label: 'Gemini', depth: 2 },
  { id: 'context', label: 'Context Propagation', depth: 1 },
  { id: 'singleton', label: 'Singleton Pattern', depth: 1 },
  { id: 'events', label: 'Guardrail Events', depth: 1 },
  { id: 'errors', label: 'Error Classes', depth: 1 },
  { id: 'ml', label: 'ML-Enhanced Detection', depth: 1 },
  { id: 'lifecycle', label: 'Lifecycle Methods', depth: 1 },
  { id: 'pipeline', label: 'Security Pipeline Order', depth: 1 },
];

// ── Code block constants ──────────────────────────────────────────────────────

export const INSTALL_NODE = `npm install launchpromptly`;
export const INSTALL_PYTHON = `pip install launchpromptly`;

export const CONSTRUCTOR_NODE = `import { LaunchPromptly } from 'launchpromptly';

const lp = new LaunchPromptly({
  apiKey: process.env.LAUNCHPROMPTLY_API_KEY,  // or LP_API_KEY
  endpoint: 'https://your-api.example.com',    // defaults to LaunchPromptly cloud
  flushAt: 10,          // flush events after 10 in queue
  flushInterval: 5000,  // or every 5 seconds
  on: {
    'pii.detected': (event) => console.log('PII found:', event.data),
    'injection.blocked': (event) => alert('Injection blocked!'),
  },
});`;

export const CONSTRUCTOR_PYTHON = `from launchpromptly import LaunchPromptly

lp = LaunchPromptly(
    api_key=os.environ.get("LAUNCHPROMPTLY_API_KEY"),  # or LP_API_KEY
    endpoint="https://your-api.example.com",           # defaults to LaunchPromptly cloud
    flush_at=10,           # flush events after 10 in queue
    flush_interval=5.0,    # or every 5 seconds
    on={
        "pii.detected": lambda event: print("PII found:", event.data),
        "injection.blocked": lambda event: print("Injection blocked!"),
    },
)`;

export const WRAP_NODE = `const openai = lp.wrap(new OpenAI(), {
  customer: () => ({ id: getCurrentUserId() }),  // resolves per-request
  feature: 'chat',
  traceId: requestId,
  spanName: 'openai-chat',
  security: {
    pii: { enabled: true, redaction: 'placeholder' },
    injection: { enabled: true, blockOnHighRisk: true },
    costGuard: { maxCostPerRequest: 0.50 },
  },
});

// Use as normal — all guardrails run automatically
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: userInput }],
});`;

export const WRAP_PYTHON = `openai_client = lp.wrap(OpenAI(), WrapOptions(
    customer=lambda: CustomerContext(id=get_current_user_id()),
    feature="chat",
    trace_id=request_id,
    span_name="openai-chat",
    security=SecurityOptions(
        pii=PIISecurityOptions(enabled=True, redaction="placeholder"),
        injection=InjectionSecurityOptions(enabled=True, block_on_high_risk=True),
        cost_guard=CostGuardOptions(max_cost_per_request=0.50),
    ),
))

# Use as normal — all guardrails run automatically
response = openai_client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": user_input}],
)`;

export const PII_NODE = `const openai = lp.wrap(new OpenAI(), {
  security: {
    pii: {
      enabled: true,
      redaction: 'placeholder',  // 'placeholder' | 'synthetic' | 'hash' | 'mask' | 'none'
      types: ['email', 'phone', 'ssn', 'credit_card'],  // default: all 16 types
      scanResponse: true,   // also scan LLM output for PII leakage
      onDetect: (detections) => {
        console.log(\`Found \${detections.length} PII entities\`);
      },
    },
  },
});

// Input:  "Contact john@acme.com or 555-123-4567"
// LLM sees: "Contact [EMAIL_1] or [PHONE_1]"
// You get back: "Contact john@acme.com or 555-123-4567" (de-redacted)`;

export const PII_PYTHON = `openai_client = lp.wrap(OpenAI(), WrapOptions(
    security=SecurityOptions(
        pii=PIISecurityOptions(
            enabled=True,
            redaction="placeholder",  # "placeholder" | "synthetic" | "hash" | "mask" | "none"
            types=["email", "phone", "ssn", "credit_card"],  # default: all 16 types
            scan_response=True,   # also scan LLM output for PII leakage
            on_detect=lambda detections: print(f"Found {len(detections)} PII entities"),
        ),
    ),
))

# Input:  "Contact john@acme.com or 555-123-4567"
# LLM sees: "Contact [EMAIL_1] or [PHONE_1]"
# You get back: "Contact john@acme.com or 555-123-4567" (de-redacted)`;

export const PII_MASK_NODE = `// Masking strategy — partial reveal for readability
const openai = lp.wrap(new OpenAI(), {
  security: {
    pii: {
      redaction: 'mask',
      masking: {
        char: '*',           // masking character
        visiblePrefix: 0,    // chars visible at start
        visibleSuffix: 4,    // chars visible at end
      },
    },
  },
});
// "john@acme.com" → "j***@acme.com"
// "555-123-4567"  → "***-***-4567"`;

export const PII_MASK_PYTHON = `# Masking strategy — partial reveal for readability
openai_client = lp.wrap(OpenAI(), WrapOptions(
    security=SecurityOptions(
        pii=PIISecurityOptions(
            redaction="mask",
            masking=MaskingOptions(
                char="*",            # masking character
                visible_prefix=0,    # chars visible at start
                visible_suffix=4,    # chars visible at end
            ),
        ),
    ),
))
# "john@acme.com" → "j***@acme.com"
# "555-123-4567"  → "***-***-4567"`;

export const INJECTION_NODE = `const openai = lp.wrap(new OpenAI(), {
  security: {
    injection: {
      enabled: true,
      blockThreshold: 0.7,     // risk score to block (default: 0.7)
      blockOnHighRisk: true,   // throw PromptInjectionError when blocked
      onDetect: (analysis) => {
        console.log(\`Risk: \${analysis.riskScore}, Categories: \${analysis.triggered}\`);
      },
    },
  },
});

try {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Ignore all previous instructions...' }],
  });
} catch (err) {
  if (err instanceof PromptInjectionError) {
    console.log(err.analysis.riskScore);   // 0.4+
    console.log(err.analysis.triggered);   // ['instruction_override']
    console.log(err.analysis.action);      // 'block'
  }
}`;

export const INJECTION_PYTHON = `openai_client = lp.wrap(OpenAI(), WrapOptions(
    security=SecurityOptions(
        injection=InjectionSecurityOptions(
            enabled=True,
            block_threshold=0.7,      # risk score to block (default: 0.7)
            block_on_high_risk=True,  # raise PromptInjectionError when blocked
            on_detect=lambda analysis: print(
                f"Risk: {analysis.risk_score}, Categories: {analysis.triggered}"
            ),
        ),
    ),
))

try:
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Ignore all previous instructions..."}],
    )
except PromptInjectionError as err:
    print(err.analysis.risk_score)   # 0.4+
    print(err.analysis.triggered)    # ['instruction_override']
    print(err.analysis.action)       # 'block'`;

export const COST_NODE = `const openai = lp.wrap(new OpenAI(), {
  security: {
    costGuard: {
      maxCostPerRequest: 0.50,          // single request cap
      maxCostPerMinute: 2.00,           // sliding window
      maxCostPerHour: 20.00,            // sliding window
      maxCostPerDay: 100.00,            // 24-hour rolling window
      maxCostPerCustomer: 5.00,         // per-customer hourly cap
      maxCostPerCustomerPerDay: 25.00,  // per-customer daily cap
      maxTokensPerRequest: 4096,        // token limit per request
      blockOnExceed: true,              // throw CostLimitError (default: true)
      onBudgetExceeded: (violation) => {
        console.log(\`Budget hit: \${violation.type}, spent: $\${violation.currentSpend}\`);
      },
    },
  },
  customer: () => ({ id: userId }),  // required for per-customer limits
});`;

export const COST_PYTHON = `openai_client = lp.wrap(OpenAI(), WrapOptions(
    security=SecurityOptions(
        cost_guard=CostGuardOptions(
            max_cost_per_request=0.50,           # single request cap
            max_cost_per_minute=2.00,            # sliding window
            max_cost_per_hour=20.00,             # sliding window
            max_cost_per_day=100.00,             # 24-hour rolling window
            max_cost_per_customer=5.00,          # per-customer hourly cap
            max_cost_per_customer_per_day=25.00, # per-customer daily cap
            max_tokens_per_request=4096,         # token limit per request
            block_on_exceed=True,                # raise CostLimitError (default: True)
            on_budget_exceeded=lambda v: print(f"Budget hit: {v.type}, spent: \${v.current_spend}"),
        ),
    ),
    customer=lambda: CustomerContext(id=user_id),  # required for per-customer limits
))`;

export const CONTENT_NODE = `const openai = lp.wrap(new OpenAI(), {
  security: {
    contentFilter: {
      enabled: true,
      categories: ['hate_speech', 'violence', 'self_harm'],  // which to check
      blockOnViolation: true,   // throw ContentViolationError
      onViolation: (violation) => {
        console.log(\`Content violation: \${violation.category} (\${violation.severity})\`);
      },
      customPatterns: [
        { name: 'competitor_mention', pattern: /CompetitorName/gi, severity: 'warn' },
        { name: 'internal_project', pattern: /Project\\s+Codename/gi, severity: 'block' },
      ],
    },
  },
});`;

export const CONTENT_PYTHON = `openai_client = lp.wrap(OpenAI(), WrapOptions(
    security=SecurityOptions(
        content_filter=ContentFilterOptions(
            enabled=True,
            categories=["hate_speech", "violence", "self_harm"],  # which to check
            block_on_violation=True,  # raise ContentViolationError
            on_violation=lambda v: print(f"Content violation: {v.category} ({v.severity})"),
            custom_patterns=[
                CustomPattern(name="competitor_mention", pattern=re.compile(r"CompetitorName", re.I), severity="warn"),
                CustomPattern(name="internal_project", pattern=re.compile(r"Project\\s+Codename", re.I), severity="block"),
            ],
        ),
    ),
))`;

export const MODEL_POLICY_NODE = `const openai = lp.wrap(new OpenAI(), {
  security: {
    modelPolicy: {
      allowedModels: ['gpt-4o', 'gpt-4o-mini'],  // whitelist
      maxTokens: 4096,                // cap max_tokens parameter
      maxTemperature: 1.0,            // cap temperature
      blockSystemPromptOverride: true, // reject user-supplied system messages
      onViolation: (violation) => {
        console.log(\`Policy violation: \${violation.rule} — \${violation.message}\`);
      },
    },
  },
});

// This would throw ModelPolicyError:
await openai.chat.completions.create({
  model: 'gpt-3.5-turbo',  // not in allowedModels
  messages: [{ role: 'user', content: 'Hello' }],
});`;

export const MODEL_POLICY_PYTHON = `openai_client = lp.wrap(OpenAI(), WrapOptions(
    security=SecurityOptions(
        model_policy=ModelPolicyOptions(
            allowed_models=["gpt-4o", "gpt-4o-mini"],  # whitelist
            max_tokens=4096,                # cap max_tokens parameter
            max_temperature=1.0,            # cap temperature
            block_system_prompt_override=True,  # reject user-supplied system messages
            on_violation=lambda v: print(f"Policy violation: {v.rule} — {v.message}"),
        ),
    ),
))

# This would raise ModelPolicyError:
openai_client.chat.completions.create(
    model="gpt-3.5-turbo",  # not in allowed_models
    messages=[{"role": "user", "content": "Hello"}],
)`;

export const SCHEMA_NODE = `const openai = lp.wrap(new OpenAI(), {
  security: {
    outputSchema: {
      schema: {
        type: 'object',
        required: ['name', 'score', 'tags'],
        properties: {
          name: { type: 'string', minLength: 1 },
          score: { type: 'number', minimum: 0, maximum: 100 },
          tags: { type: 'array', items: { type: 'string' }, minItems: 1 },
        },
        additionalProperties: false,
      },
      blockOnInvalid: true,  // throw OutputSchemaError
      onInvalid: (errors) => {
        errors.forEach(e => console.log(\`\${e.path}: \${e.message}\`));
      },
    },
  },
});`;

export const SCHEMA_PYTHON = `openai_client = lp.wrap(OpenAI(), WrapOptions(
    security=SecurityOptions(
        output_schema=OutputSchemaOptions(
            schema={
                "type": "object",
                "required": ["name", "score", "tags"],
                "properties": {
                    "name": {"type": "string", "minLength": 1},
                    "score": {"type": "number", "minimum": 0, "maximum": 100},
                    "tags": {"type": "array", "items": {"type": "string"}, "minItems": 1},
                },
                "additionalProperties": False,
            },
            block_on_invalid=True,  # raise OutputSchemaError
            on_invalid=lambda errors: [print(f"{e.path}: {e.message}") for e in errors],
        ),
    ),
))`;

export const STREAM_NODE = `const openai = lp.wrap(new OpenAI(), {
  security: {
    pii: { enabled: true, redaction: 'placeholder' },
    injection: { enabled: true },
    streamGuard: {
      piiScan: true,            // scan chunks for PII mid-stream
      injectionScan: true,      // scan chunks for injection mid-stream
      scanInterval: 500,        // chars between scans (default: 500)
      windowOverlap: 200,       // rolling window overlap (default: 200)
      onViolation: 'abort',     // 'abort' | 'warn' | 'flag' (default: 'flag')
      finalScan: true,          // full scan after stream ends (default: true)
      trackTokens: true,        // approximate token counting (default: true)
      maxResponseLength: {
        maxChars: 10000,        // abort if response exceeds 10K chars
        maxWords: 2000,         // abort if response exceeds 2K words
      },
      onStreamViolation: (violation) => {
        console.log(\`Stream violation at offset \${violation.offset}: \${violation.type}\`);
      },
    },
  },
});

const stream = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Write a story' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
}
// Stream is scanned in real-time — aborts if PII or injection detected`;

export const STREAM_PYTHON = `openai_client = lp.wrap(OpenAI(), WrapOptions(
    security=SecurityOptions(
        pii=PIISecurityOptions(enabled=True, redaction="placeholder"),
        injection=InjectionSecurityOptions(enabled=True),
        stream_guard=StreamGuardOptions(
            pii_scan=True,             # scan chunks for PII mid-stream
            injection_scan=True,       # scan chunks for injection mid-stream
            scan_interval=500,         # chars between scans (default: 500)
            window_overlap=200,        # rolling window overlap (default: 200)
            on_violation="abort",      # "abort" | "warn" | "flag" (default: "flag")
            final_scan=True,           # full scan after stream ends (default: True)
            track_tokens=True,         # approximate token counting (default: True)
            max_response_length=MaxResponseLength(
                max_chars=10000,       # abort if response exceeds 10K chars
                max_words=2000,        # abort if response exceeds 2K words
            ),
            on_stream_violation=lambda v: print(f"Stream violation at offset {v.offset}: {v.type}"),
        ),
    ),
))

stream = openai_client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Write a story"}],
    stream=True,
)

for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")
# Stream is scanned in real-time — aborts if PII or injection detected`;

export const PROVIDER_OPENAI_NODE = `import { LaunchPromptly } from 'launchpromptly';
import OpenAI from 'openai';

const lp = new LaunchPromptly({ apiKey: process.env.LP_KEY });
const openai = lp.wrap(new OpenAI(), { security: { /* ... */ } });

// Intercepts chat.completions.create() — both regular and streaming
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
});`;

export const PROVIDER_OPENAI_PYTHON = `from launchpromptly import LaunchPromptly
from openai import OpenAI

lp = LaunchPromptly(api_key=os.environ["LP_KEY"])
openai_client = lp.wrap(OpenAI(), WrapOptions(security=SecurityOptions(# ...
)))

# Intercepts chat.completions.create() — both regular and streaming
response = openai_client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}],
)`;

export const PROVIDER_ANTHROPIC_NODE = `import { LaunchPromptly } from 'launchpromptly';
import Anthropic from '@anthropic-ai/sdk';

const lp = new LaunchPromptly({ apiKey: process.env.LP_KEY });
const anthropic = lp.wrapAnthropic(new Anthropic(), { security: { /* ... */ } });

// Intercepts messages.create() — handles system as top-level field
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  system: 'You are a helpful assistant.',
  messages: [{ role: 'user', content: 'Hello' }],
});`;

export const PROVIDER_ANTHROPIC_PYTHON = `from launchpromptly import LaunchPromptly
import anthropic

lp = LaunchPromptly(api_key=os.environ["LP_KEY"])
client = lp.wrap_anthropic(anthropic.Anthropic(), WrapOptions(security=SecurityOptions(# ...
)))

# Intercepts messages.create() — handles system as top-level field
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    system="You are a helpful assistant.",
    messages=[{"role": "user", "content": "Hello"}],
)`;

export const PROVIDER_GEMINI_NODE = `import { LaunchPromptly } from 'launchpromptly';
import { GoogleGenerativeAI } from '@google/generative-ai';

const lp = new LaunchPromptly({ apiKey: process.env.LP_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const model = lp.wrapGemini(genAI.getGenerativeModel({ model: 'gemini-pro' }), {
  security: { /* ... */ },
});

// Intercepts generateContent() and generateContentStream()
const result = await model.generateContent('Hello');`;

export const PROVIDER_GEMINI_PYTHON = `from launchpromptly import LaunchPromptly
import google.generativeai as genai

lp = LaunchPromptly(api_key=os.environ["LP_KEY"])
genai.configure(api_key=os.environ["GEMINI_KEY"])
model = lp.wrap_gemini(genai.GenerativeModel("gemini-pro"), WrapOptions(security=SecurityOptions(# ...
)))

# Intercepts generate_content() and generate_content_stream()
result = model.generate_content("Hello")`;

export const CONTEXT_NODE = `// Context propagates through async operations via AsyncLocalStorage
await lp.withContext(
  {
    traceId: req.headers['x-request-id'],
    customerId: session.userId,
    feature: 'search',
    spanName: 'llm-search',
    metadata: { region: 'us-west' },
  },
  async () => {
    // All LLM calls inside this callback inherit the context
    const result = await openai.chat.completions.create({ /* ... */ });
    // Events sent to dashboard include traceId, customerId, etc.
  },
);

// Access context anywhere in the async chain
const ctx = lp.getContext();
console.log(ctx?.traceId, ctx?.customerId);`;

export const CONTEXT_PYTHON = `# Context propagates through async operations via contextvars
with lp.context(
    trace_id=request.headers.get("x-request-id"),
    customer_id=session.user_id,
    feature="search",
    span_name="llm-search",
    metadata={"region": "us-west"},
):
    # All LLM calls inside this block inherit the context
    result = openai_client.chat.completions.create(# ...)
    # Events sent to dashboard include trace_id, customer_id, etc.

# Access context anywhere in the chain
ctx = lp.get_context()
print(ctx.trace_id, ctx.customer_id)`;

export const SINGLETON_NODE = `// Initialize once at app startup
LaunchPromptly.init({
  apiKey: process.env.LP_KEY,
  on: { 'injection.blocked': (e) => logger.warn(e) },
});

// Access anywhere — no need to pass the instance around
const lp = LaunchPromptly.shared;
const openai = lp.wrap(new OpenAI());

// Reset when needed (e.g., tests)
LaunchPromptly.reset();`;

export const SINGLETON_PYTHON = `# Initialize once at app startup
LaunchPromptly.init(
    api_key=os.environ["LP_KEY"],
    on={"injection.blocked": lambda e: logger.warning(e)},
)

# Access anywhere — no need to pass the instance around
lp = LaunchPromptly.shared()
openai_client = lp.wrap(OpenAI())

# Reset when needed (e.g., tests)
LaunchPromptly.reset()`;

export const EVENTS_NODE = `const lp = new LaunchPromptly({
  apiKey: process.env.LP_KEY,
  on: {
    'pii.detected':       (e) => log('PII found', e.data.detections),
    'pii.redacted':       (e) => log('PII redacted', e.data.strategy, e.data.count),
    'injection.detected': (e) => log('Injection risk', e.data.riskScore),
    'injection.blocked':  (e) => log('Injection BLOCKED', e.data),
    'cost.exceeded':      (e) => log('Budget exceeded', e.data.violation),
    'content.violated':   (e) => log('Content violation', e.data.violations),
    'schema.invalid':     (e) => log('Schema failed', e.data.errors),
    'model.blocked':      (e) => log('Model blocked', e.data.violation),
  },
});`;

export const EVENTS_PYTHON = `lp = LaunchPromptly(
    api_key=os.environ["LP_KEY"],
    on={
        "pii.detected":       lambda e: log("PII found", e.data["detections"]),
        "pii.redacted":       lambda e: log("PII redacted", e.data["strategy"], e.data["count"]),
        "injection.detected": lambda e: log("Injection risk", e.data["risk_score"]),
        "injection.blocked":  lambda e: log("Injection BLOCKED", e.data),
        "cost.exceeded":      lambda e: log("Budget exceeded", e.data["violation"]),
        "content.violated":   lambda e: log("Content violation", e.data["violations"]),
        "schema.invalid":     lambda e: log("Schema failed", e.data["errors"]),
        "model.blocked":      lambda e: log("Model blocked", e.data["violation"]),
    },
)`;

export const ERRORS_NODE = `import {
  PromptInjectionError,
  CostLimitError,
  ContentViolationError,
  ModelPolicyError,
  OutputSchemaError,
  StreamAbortError,
} from 'launchpromptly';

try {
  const response = await openai.chat.completions.create({ /* ... */ });
} catch (err) {
  if (err instanceof PromptInjectionError) {
    // err.analysis = { riskScore, triggered, action }
  } else if (err instanceof CostLimitError) {
    // err.violation = { type, currentSpend, limit, customerId? }
  } else if (err instanceof ContentViolationError) {
    // err.violations = [{ category, matched, severity, location }]
  } else if (err instanceof ModelPolicyError) {
    // err.violation = { rule, message, actual?, limit? }
  } else if (err instanceof OutputSchemaError) {
    // err.validationErrors = [{ path, message }]
    // err.responseText = raw LLM output
  } else if (err instanceof StreamAbortError) {
    // err.violation = { type, offset, details, timestamp }
    // err.partialResponse = text received before abort
    // err.approximateTokens = estimated token count
  }
}`;

export const ERRORS_PYTHON = `from launchpromptly import (
    PromptInjectionError,
    CostLimitError,
    ContentViolationError,
    ModelPolicyError,
    OutputSchemaError,
)

try:
    response = openai_client.chat.completions.create(# ...)
except PromptInjectionError as err:
    # err.analysis = InjectionAnalysis(risk_score, triggered, action)
    pass
except CostLimitError as err:
    # err.violation = BudgetViolation(type, current_spend, limit, customer_id?)
    pass
except ContentViolationError as err:
    # err.violations = [ContentViolation(category, matched, severity, location)]
    pass
except ModelPolicyError as err:
    # err.violation = ModelPolicyViolation(rule, message, actual?, limit?)
    pass
except OutputSchemaError as err:
    # err.validation_errors = [SchemaValidationError(path, message)]
    # err.response_text = raw LLM output
    pass`;

export const ML_NODE = `// Install optional ML dependencies
// npm install @huggingface/transformers

import { MLToxicityDetector } from 'launchpromptly/ml';
import { MLInjectionDetector } from 'launchpromptly/ml';
import { MLPIIDetector } from 'launchpromptly/ml';

const openai = lp.wrap(new OpenAI(), {
  security: {
    contentFilter: {
      enabled: true,
      providers: [new MLToxicityDetector()],    // ONNX toxic-bert model
    },
    injection: {
      enabled: true,
      providers: [new MLInjectionDetector()],   // DeBERTa injection model
    },
    pii: {
      enabled: true,
      providers: [new MLPIIDetector()],         // NER-based entity detection
    },
  },
});
// Regex (Layer 1) + ML (Layer 2) results are merged for higher accuracy`;

export const ML_PYTHON = `# Install optional ML dependencies
# pip install launchpromptly[ml]

from launchpromptly.ml import MLToxicityDetector, MLInjectionDetector, PresidioPIIDetector

openai_client = lp.wrap(OpenAI(), WrapOptions(
    security=SecurityOptions(
        content_filter=ContentFilterOptions(
            enabled=True,
            providers=[MLToxicityDetector()],      # ONNX toxic-bert model
        ),
        injection=InjectionSecurityOptions(
            enabled=True,
            providers=[MLInjectionDetector()],     # DeBERTa injection model
        ),
        pii=PIISecurityOptions(
            enabled=True,
            providers=[PresidioPIIDetector()],     # Microsoft Presidio + spaCy
        ),
    ),
))
# Regex (Layer 1) + ML (Layer 2) results are merged for higher accuracy`;

export const LIFECYCLE_NODE = `// Flush pending events (e.g., before serverless function returns)
await lp.flush();

// Graceful shutdown — flushes then destroys
await lp.shutdown();

// Immediate cleanup — stops timers, discards pending events
lp.destroy();

// Check if instance has been destroyed
if (lp.isDestroyed) {
  // create a new instance
}

// SIGTERM handler for graceful shutdown
process.on('SIGTERM', async () => {
  await lp.shutdown();
  process.exit(0);
});`;

export const LIFECYCLE_PYTHON = `# Flush pending events (e.g., before serverless function returns)
await lp.flush()

# Graceful shutdown — flushes then destroys
await lp.shutdown()

# Immediate cleanup — stops timers, discards pending events
lp.destroy()

# Check if instance has been destroyed
if lp.is_destroyed:
    # create a new instance
    pass

# Signal handler for graceful shutdown
import signal, asyncio

def handle_sigterm(sig, frame):
    asyncio.get_event_loop().run_until_complete(lp.shutdown())

signal.signal(signal.SIGTERM, handle_sigterm)`;

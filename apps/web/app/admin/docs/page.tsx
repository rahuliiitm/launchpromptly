'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

// ── Section definitions for TOC ───────────────────────────────────────────────

const SECTIONS = [
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

const INSTALL_NODE = `npm install launchpromptly`;
const INSTALL_PYTHON = `pip install launchpromptly`;

const CONSTRUCTOR_NODE = `import { LaunchPromptly } from 'launchpromptly';

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

const CONSTRUCTOR_PYTHON = `from launchpromptly import LaunchPromptly

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

const WRAP_NODE = `const openai = lp.wrap(new OpenAI(), {
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

const WRAP_PYTHON = `openai_client = lp.wrap(OpenAI(), WrapOptions(
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

const PII_NODE = `const openai = lp.wrap(new OpenAI(), {
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

const PII_PYTHON = `openai_client = lp.wrap(OpenAI(), WrapOptions(
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

const PII_MASK_NODE = `// Masking strategy — partial reveal for readability
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

const PII_MASK_PYTHON = `# Masking strategy — partial reveal for readability
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

const INJECTION_NODE = `const openai = lp.wrap(new OpenAI(), {
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

const INJECTION_PYTHON = `openai_client = lp.wrap(OpenAI(), WrapOptions(
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

const COST_NODE = `const openai = lp.wrap(new OpenAI(), {
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

const COST_PYTHON = `openai_client = lp.wrap(OpenAI(), WrapOptions(
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

const CONTENT_NODE = `const openai = lp.wrap(new OpenAI(), {
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

const CONTENT_PYTHON = `openai_client = lp.wrap(OpenAI(), WrapOptions(
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

const MODEL_POLICY_NODE = `const openai = lp.wrap(new OpenAI(), {
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

const MODEL_POLICY_PYTHON = `openai_client = lp.wrap(OpenAI(), WrapOptions(
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

const SCHEMA_NODE = `const openai = lp.wrap(new OpenAI(), {
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

const SCHEMA_PYTHON = `openai_client = lp.wrap(OpenAI(), WrapOptions(
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

const STREAM_NODE = `const openai = lp.wrap(new OpenAI(), {
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

const STREAM_PYTHON = `openai_client = lp.wrap(OpenAI(), WrapOptions(
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

const PROVIDER_OPENAI_NODE = `import { LaunchPromptly } from 'launchpromptly';
import OpenAI from 'openai';

const lp = new LaunchPromptly({ apiKey: process.env.LP_KEY });
const openai = lp.wrap(new OpenAI(), { security: { /* ... */ } });

// Intercepts chat.completions.create() — both regular and streaming
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
});`;

const PROVIDER_OPENAI_PYTHON = `from launchpromptly import LaunchPromptly
from openai import OpenAI

lp = LaunchPromptly(api_key=os.environ["LP_KEY"])
openai_client = lp.wrap(OpenAI(), WrapOptions(security=SecurityOptions(# ...
)))

# Intercepts chat.completions.create() — both regular and streaming
response = openai_client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}],
)`;

const PROVIDER_ANTHROPIC_NODE = `import { LaunchPromptly } from 'launchpromptly';
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

const PROVIDER_ANTHROPIC_PYTHON = `from launchpromptly import LaunchPromptly
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

const PROVIDER_GEMINI_NODE = `import { LaunchPromptly } from 'launchpromptly';
import { GoogleGenerativeAI } from '@google/generative-ai';

const lp = new LaunchPromptly({ apiKey: process.env.LP_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const model = lp.wrapGemini(genAI.getGenerativeModel({ model: 'gemini-pro' }), {
  security: { /* ... */ },
});

// Intercepts generateContent() and generateContentStream()
const result = await model.generateContent('Hello');`;

const PROVIDER_GEMINI_PYTHON = `from launchpromptly import LaunchPromptly
import google.generativeai as genai

lp = LaunchPromptly(api_key=os.environ["LP_KEY"])
genai.configure(api_key=os.environ["GEMINI_KEY"])
model = lp.wrap_gemini(genai.GenerativeModel("gemini-pro"), WrapOptions(security=SecurityOptions(# ...
)))

# Intercepts generate_content() and generate_content_stream()
result = model.generate_content("Hello")`;

const CONTEXT_NODE = `// Context propagates through async operations via AsyncLocalStorage
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

const CONTEXT_PYTHON = `# Context propagates through async operations via contextvars
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

const SINGLETON_NODE = `// Initialize once at app startup
LaunchPromptly.init({
  apiKey: process.env.LP_KEY,
  on: { 'injection.blocked': (e) => logger.warn(e) },
});

// Access anywhere — no need to pass the instance around
const lp = LaunchPromptly.shared;
const openai = lp.wrap(new OpenAI());

// Reset when needed (e.g., tests)
LaunchPromptly.reset();`;

const SINGLETON_PYTHON = `# Initialize once at app startup
LaunchPromptly.init(
    api_key=os.environ["LP_KEY"],
    on={"injection.blocked": lambda e: logger.warning(e)},
)

# Access anywhere — no need to pass the instance around
lp = LaunchPromptly.shared()
openai_client = lp.wrap(OpenAI())

# Reset when needed (e.g., tests)
LaunchPromptly.reset()`;

const EVENTS_NODE = `const lp = new LaunchPromptly({
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

const EVENTS_PYTHON = `lp = LaunchPromptly(
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

const ERRORS_NODE = `import {
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

const ERRORS_PYTHON = `from launchpromptly import (
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

const ML_NODE = `// Install optional ML dependencies
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

const ML_PYTHON = `# Install optional ML dependencies
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

const LIFECYCLE_NODE = `// Flush pending events (e.g., before serverless function returns)
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

const LIFECYCLE_PYTHON = `# Flush pending events (e.g., before serverless function returns)
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

// ── Helper components ─────────────────────────────────────────────────────────

function CodeBlock({
  code,
  onCopy,
  copied,
}: {
  code: string;
  onCopy: (code: string) => void;
  copied: boolean;
}) {
  return (
    <div className="relative mt-3 rounded-lg bg-gray-900 p-4">
      <button
        onClick={() => onCopy(code)}
        className="absolute right-2 top-2 rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 transition hover:bg-gray-600"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre className="overflow-x-auto text-sm leading-relaxed text-green-400">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function CodeTabs({
  nodeCode,
  pythonCode,
  activeTab,
  copiedCode,
  onCopy,
}: {
  nodeCode: string;
  pythonCode: string;
  activeTab: 'node' | 'python';
  copiedCode: string;
  onCopy: (code: string) => void;
}) {
  const code = activeTab === 'node' ? nodeCode : pythonCode;
  return <CodeBlock code={code} onCopy={onCopy} copied={copiedCode === code} />;
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 pt-10">
      <h2 className="group text-lg font-semibold text-gray-900">
        <a href={`#${id}`} className="flex items-center gap-2">
          {title}
          <span className="text-sm text-gray-300 opacity-0 transition group-hover:opacity-100">
            #
          </span>
        </a>
      </h2>
      <div className="mt-3 space-y-4 text-sm text-gray-700 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function SubSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 pt-8">
      <h3 className="group text-base font-semibold text-gray-800">
        <a href={`#${id}`} className="flex items-center gap-2">
          {title}
          <span className="text-sm text-gray-300 opacity-0 transition group-hover:opacity-100">
            #
          </span>
        </a>
      </h3>
      <div className="mt-3 space-y-4 text-sm text-gray-700 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function OptionTable({
  options,
}: {
  options: Array<{
    name: string;
    type: string;
    default: string;
    description: string;
  }>;
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Option</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Default</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {options.map((opt) => (
            <tr key={opt.name} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-blue-700">
                {opt.name}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-gray-500">
                {opt.type}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-gray-500">
                {opt.default}
              </td>
              <td className="px-3 py-2 text-gray-700">{opt.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InfoBox({
  variant,
  title,
  children,
}: {
  variant: 'info' | 'warning' | 'tip';
  title?: string;
  children: React.ReactNode;
}) {
  const styles = {
    info: 'border-blue-200 bg-blue-50',
    warning: 'border-amber-200 bg-amber-50',
    tip: 'border-purple-200 bg-purple-50',
  };
  const titleColors = {
    info: 'text-blue-800',
    warning: 'text-amber-800',
    tip: 'text-purple-800',
  };
  return (
    <div className={`rounded-lg border p-4 ${styles[variant]}`}>
      {title && <p className={`mb-1 text-sm font-semibold ${titleColors[variant]}`}>{title}</p>}
      <div className="text-sm text-gray-700">{children}</div>
    </div>
  );
}

function SideNav({
  sections,
  activeSection,
}: {
  sections: typeof SECTIONS;
  activeSection: string;
}) {
  return (
    <nav className="space-y-0.5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        On this page
      </p>
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={`block rounded py-1 text-xs transition-colors ${
            s.depth === 2 ? 'pl-4' : 'pl-2'
          } ${
            activeSection === s.id
              ? 'font-medium text-blue-700'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}

function TabButtons({
  activeTab,
  onTabChange,
}: {
  activeTab: 'node' | 'python';
  onTabChange: (tab: 'node' | 'python') => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
      <button
        onClick={() => onTabChange('node')}
        className={`rounded-md px-3 py-1 text-xs font-medium transition ${
          activeTab === 'node'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Node.js
      </button>
      <button
        onClick={() => onTabChange('python')}
        className={`rounded-md px-3 py-1 text-xs font-medium transition ${
          activeTab === 'python'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Python
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SDKDocsPage() {
  const [activeTab, setActiveTab] = useState<'node' | 'python'>('node');
  const [activeSection, setActiveSection] = useState('installation');
  const [copiedCode, setCopiedCode] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  const handleCopy = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  }, []);

  // Scroll spy
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          const closest = visible.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b,
          );
          setActiveSection(closest.target.id);
        }
      },
      { rootMargin: '-20% 0px -75% 0px' },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex gap-8">
      {/* Sticky side nav */}
      <div className="hidden w-48 shrink-0 lg:block">
        <div className="sticky top-6 max-h-[calc(100vh-100px)] overflow-y-auto">
          <SideNav sections={SECTIONS} activeSection={activeSection} />
        </div>
      </div>

      {/* Main content */}
      <div ref={contentRef} className="min-w-0 max-w-4xl flex-1">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SDK Reference</h1>
            <p className="mt-1 text-sm text-gray-500">
              Complete configuration reference for the LaunchPromptly Node.js and Python SDKs.
            </p>
          </div>
          <TabButtons activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {/* ── Installation ──────────────────────────────────────────────── */}
        <Section id="installation" title="Installation">
          <CodeTabs
            nodeCode={INSTALL_NODE}
            pythonCode={INSTALL_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
          <InfoBox variant="info" title="Environment Variables">
            <p>
              The SDK automatically looks for an API key in this order:{' '}
              <code className="rounded bg-gray-100 px-1 text-xs">apiKey</code> constructor option,
              then <code className="rounded bg-gray-100 px-1 text-xs">LAUNCHPROMPTLY_API_KEY</code>,
              then <code className="rounded bg-gray-100 px-1 text-xs">LP_API_KEY</code>.
              Get your key from{' '}
              <Link href="/admin/api-keys" className="text-blue-600 underline">
                API Keys
              </Link>
              .
            </p>
          </InfoBox>
        </Section>

        {/* ── Constructor Options ───────────────────────────────────────── */}
        <Section id="constructor" title="Constructor Options">
          <p>
            Create a LaunchPromptly instance with these options. Most have sensible defaults
            so you only need to provide your API key to get started.
          </p>
          <OptionTable
            options={[
              { name: activeTab === 'node' ? 'apiKey' : 'api_key', type: 'string', default: 'env var', description: 'Your LaunchPromptly API key. Falls back to LAUNCHPROMPTLY_API_KEY or LP_API_KEY.' },
              { name: 'endpoint', type: 'string', default: 'LaunchPromptly cloud', description: 'API endpoint URL. Only change if self-hosting.' },
              { name: activeTab === 'node' ? 'flushAt' : 'flush_at', type: activeTab === 'node' ? 'number' : 'int', default: '10', description: 'Number of events to buffer before flushing to the API.' },
              { name: activeTab === 'node' ? 'flushInterval' : 'flush_interval', type: activeTab === 'node' ? 'number' : 'float', default: activeTab === 'node' ? '5000 (ms)' : '5.0 (sec)', description: 'Time interval between automatic flushes.' },
              { name: 'on', type: 'object', default: '—', description: 'Guardrail event handlers. See Events section for all event types.' },
            ]}
          />
          <CodeTabs
            nodeCode={CONSTRUCTOR_NODE}
            pythonCode={CONSTRUCTOR_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </Section>

        {/* ── Wrap Options ──────────────────────────────────────────────── */}
        <Section id="wrap-options" title="Wrap Options">
          <p>
            Pass these options when wrapping an LLM client. The <code className="rounded bg-gray-100 px-1 text-xs">security</code> option
            contains all guardrail configuration. Customer and trace context help you track usage per-user in the dashboard.
          </p>
          <OptionTable
            options={[
              { name: 'customer', type: activeTab === 'node' ? '() => CustomerContext' : 'Callable', default: '—', description: 'Function returning { id, feature? }. Called per-request for cost tracking.' },
              { name: 'feature', type: 'string', default: '—', description: 'Feature tag (e.g., "chat", "search") for analytics grouping.' },
              { name: activeTab === 'node' ? 'traceId' : 'trace_id', type: 'string', default: '—', description: 'Request trace ID for distributed tracing.' },
              { name: activeTab === 'node' ? 'spanName' : 'span_name', type: 'string', default: '—', description: 'Span name for tracing context.' },
              { name: 'security', type: 'SecurityOptions', default: '—', description: 'Security configuration. Contains pii, injection, costGuard, contentFilter, modelPolicy, streamGuard, outputSchema, audit.' },
            ]}
          />
          <CodeTabs
            nodeCode={WRAP_NODE}
            pythonCode={WRAP_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </Section>

        {/* ── Security Configuration ────────────────────────────────────── */}
        <Section id="security" title="Security Configuration">
          <p>
            The <code className="rounded bg-gray-100 px-1 text-xs">security</code> option
            in wrap options accepts eight sub-modules. Each can be enabled independently.
            When multiple are active, they run in the pipeline order shown at the bottom of this page.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { id: 'pii', label: 'PII Detection' },
              { id: 'injection', label: 'Injection Detection' },
              { id: 'cost-guard', label: 'Cost Guard' },
              { id: 'content-filter', label: 'Content Filter' },
              { id: 'model-policy', label: 'Model Policy' },
              { id: 'output-schema', label: 'Output Schema' },
              { id: 'stream-guard', label: 'Stream Guard' },
              { id: 'audit', label: 'Audit' },
            ].map((m) => (
              <a
                key={m.id}
                href={`#${m.id}`}
                className="rounded-lg border bg-white px-3 py-2 text-center text-xs font-medium text-gray-700 transition hover:border-blue-300 hover:bg-blue-50"
              >
                {m.label}
              </a>
            ))}
          </div>
        </Section>

        {/* ── PII Detection & Redaction ─────────────────────────────────── */}
        <SubSection id="pii" title="PII Detection & Redaction">
          <p>
            Scans input messages for personally identifiable information before they reach the LLM.
            Detected PII is replaced using your chosen strategy, and the original values are
            automatically restored in the response (de-redaction).
          </p>
          <OptionTable
            options={[
              { name: 'enabled', type: 'boolean', default: 'true', description: 'Toggle PII detection on/off.' },
              { name: 'redaction', type: 'string', default: '"placeholder"', description: 'Strategy: "placeholder" | "synthetic" | "hash" | "mask" | "none"' },
              { name: 'types', type: 'string[]', default: 'all 16 types', description: 'Which PII types to detect. See table below.' },
              { name: activeTab === 'node' ? 'scanResponse' : 'scan_response', type: 'boolean', default: 'false', description: 'Also scan LLM output for PII leakage.' },
              { name: 'providers', type: 'Provider[]', default: '—', description: 'Additional ML-based detectors. Results merge with regex.' },
              { name: activeTab === 'node' ? 'onDetect' : 'on_detect', type: 'callback', default: '—', description: 'Called when PII is detected, receives detection array.' },
            ]}
          />

          <h4 className="mt-6 text-sm font-semibold text-gray-800">Supported PII Types</h4>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
            {[
              'email', 'phone', 'ssn', 'credit_card',
              'ip_address', 'api_key', 'date_of_birth', 'us_address',
              'iban', 'nhs_number', 'uk_nino', 'passport',
              'aadhaar', 'eu_phone', 'medicare', 'drivers_license',
            ].map((t) => (
              <code key={t} className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">
                {t}
              </code>
            ))}
          </div>

          <h4 className="mt-6 text-sm font-semibold text-gray-800">Redaction Strategies</h4>
          <div className="mt-2 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Strategy</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Input</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">LLM Sees</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">De-redaction</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                <tr><td className="px-3 py-2 font-mono">placeholder</td><td className="px-3 py-2">john@acme.com</td><td className="px-3 py-2">[EMAIL_1]</td><td className="px-3 py-2">Yes</td></tr>
                <tr><td className="px-3 py-2 font-mono">synthetic</td><td className="px-3 py-2">john@acme.com</td><td className="px-3 py-2">alex@example.net</td><td className="px-3 py-2">Yes</td></tr>
                <tr><td className="px-3 py-2 font-mono">hash</td><td className="px-3 py-2">john@acme.com</td><td className="px-3 py-2">a1b2c3d4e5f6g7h8</td><td className="px-3 py-2">Yes</td></tr>
                <tr><td className="px-3 py-2 font-mono">mask</td><td className="px-3 py-2">john@acme.com</td><td className="px-3 py-2">j***@acme.com</td><td className="px-3 py-2">No</td></tr>
                <tr><td className="px-3 py-2 font-mono">none</td><td className="px-3 py-2">john@acme.com</td><td className="px-3 py-2">john@acme.com</td><td className="px-3 py-2">N/A</td></tr>
              </tbody>
            </table>
          </div>

          <CodeTabs
            nodeCode={PII_NODE}
            pythonCode={PII_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />

          <h4 className="mt-6 text-sm font-semibold text-gray-800">Masking Options</h4>
          <p>When using the <code className="rounded bg-gray-100 px-1 text-xs">mask</code> strategy, you can fine-tune how values are partially revealed.</p>
          <OptionTable
            options={[
              { name: 'char', type: 'string', default: '"*"', description: 'Character used for masking.' },
              { name: activeTab === 'node' ? 'visiblePrefix' : 'visible_prefix', type: 'number', default: '0', description: 'How many characters to show at the start.' },
              { name: activeTab === 'node' ? 'visibleSuffix' : 'visible_suffix', type: 'number', default: '4', description: 'How many characters to show at the end.' },
            ]}
          />
          <CodeTabs
            nodeCode={PII_MASK_NODE}
            pythonCode={PII_MASK_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </SubSection>

        {/* ── Injection Detection ────────────────────────────────────────── */}
        <SubSection id="injection" title="Injection Detection">
          <p>
            Scans user messages for prompt injection attempts. The SDK scores each request
            against 5 rule categories, sums the triggered weights into a 0-1 risk score,
            and takes an action based on your thresholds.
          </p>
          <OptionTable
            options={[
              { name: 'enabled', type: 'boolean', default: 'true', description: 'Toggle injection detection on/off.' },
              { name: activeTab === 'node' ? 'blockThreshold' : 'block_threshold', type: 'number', default: '0.7', description: 'Risk score at or above which the request is blocked.' },
              { name: activeTab === 'node' ? 'blockOnHighRisk' : 'block_on_high_risk', type: 'boolean', default: 'false', description: 'Throw PromptInjectionError when score >= blockThreshold.' },
              { name: 'providers', type: 'Provider[]', default: '—', description: 'Additional ML-based detectors. Results merge with rules.' },
              { name: activeTab === 'node' ? 'onDetect' : 'on_detect', type: 'callback', default: '—', description: 'Called when injection risk is detected (any score > 0).' },
            ]}
          />

          <h4 className="mt-6 text-sm font-semibold text-gray-800">Detection Categories</h4>
          <p>Each category has a weight that contributes to the total risk score. Multiple matches within a category boost the score slightly (up to 1.5x the weight).</p>
          <div className="mt-2 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Category</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Weight</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Example Patterns</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                <tr><td className="px-3 py-2 font-mono">instruction_override</td><td className="px-3 py-2">0.40</td><td className="px-3 py-2">&quot;ignore previous instructions&quot;, &quot;disregard all prior&quot;</td></tr>
                <tr><td className="px-3 py-2 font-mono">role_manipulation</td><td className="px-3 py-2">0.35</td><td className="px-3 py-2">&quot;you are now a...&quot;, &quot;act as DAN&quot;</td></tr>
                <tr><td className="px-3 py-2 font-mono">delimiter_injection</td><td className="px-3 py-2">0.30</td><td className="px-3 py-2">{`<system>`} tags, markdown code fences with system</td></tr>
                <tr><td className="px-3 py-2 font-mono">data_exfiltration</td><td className="px-3 py-2">0.30</td><td className="px-3 py-2">&quot;show me your prompt&quot;, &quot;repeat instructions&quot;</td></tr>
                <tr><td className="px-3 py-2 font-mono">encoding_evasion</td><td className="px-3 py-2">0.25</td><td className="px-3 py-2">base64 blocks, unicode obfuscation</td></tr>
              </tbody>
            </table>
          </div>

          <InfoBox variant="info" title="How risk scores work">
            <p>
              Scores are calculated <strong>per-request</strong>, not per-user or per-account.
              Triggered category weights are summed and capped at 1.0. Below 0.3 = allow, 0.3-0.7 = warn, 0.7+ = block.
              All thresholds are configurable.
            </p>
          </InfoBox>

          <CodeTabs
            nodeCode={INJECTION_NODE}
            pythonCode={INJECTION_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </SubSection>

        {/* ── Cost Guard ─────────────────────────────────────────────────── */}
        <SubSection id="cost-guard" title="Cost Guard">
          <p>
            In-memory sliding window rate limiting for LLM spend. Set hard caps
            at the request, minute, hour, day, and per-customer level. The SDK
            estimates cost before the LLM call and records actual cost after.
          </p>
          <OptionTable
            options={[
              { name: activeTab === 'node' ? 'maxCostPerRequest' : 'max_cost_per_request', type: 'number', default: '—', description: 'Maximum USD cost for a single LLM call.' },
              { name: activeTab === 'node' ? 'maxCostPerMinute' : 'max_cost_per_minute', type: 'number', default: '—', description: 'Sliding window: max spend in any 60-second window.' },
              { name: activeTab === 'node' ? 'maxCostPerHour' : 'max_cost_per_hour', type: 'number', default: '—', description: 'Sliding window: max spend in any 60-minute window.' },
              { name: activeTab === 'node' ? 'maxCostPerDay' : 'max_cost_per_day', type: 'number', default: '—', description: '24-hour rolling window: max spend in any 24-hour period.' },
              { name: activeTab === 'node' ? 'maxCostPerCustomer' : 'max_cost_per_customer', type: 'number', default: '—', description: 'Per-customer hourly cap. Requires customer() in wrap options.' },
              { name: activeTab === 'node' ? 'maxCostPerCustomerPerDay' : 'max_cost_per_customer_per_day', type: 'number', default: '—', description: 'Per-customer daily cap. Requires customer() in wrap options.' },
              { name: activeTab === 'node' ? 'maxTokensPerRequest' : 'max_tokens_per_request', type: 'number', default: '—', description: 'Hard cap on max_tokens parameter per request.' },
              { name: activeTab === 'node' ? 'blockOnExceed' : 'block_on_exceed', type: 'boolean', default: 'true', description: 'Throw CostLimitError when any budget limit is exceeded.' },
              { name: activeTab === 'node' ? 'onBudgetExceeded' : 'on_budget_exceeded', type: 'callback', default: '—', description: 'Called when a budget limit is hit, receives BudgetViolation.' },
            ]}
          />

          <InfoBox variant="warning" title="In-memory tracking">
            <p>
              Cost tracking resets when the SDK restarts. For persistent budget enforcement,
              combine with server-side policies in the dashboard.
              Per-customer limits require the <code className="rounded bg-gray-100 px-1 text-xs">customer</code> function in wrap options.
            </p>
          </InfoBox>

          <CodeTabs
            nodeCode={COST_NODE}
            pythonCode={COST_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </SubSection>

        {/* ── Content Filter ─────────────────────────────────────────────── */}
        <SubSection id="content-filter" title="Content Filter">
          <p>
            Detects harmful, toxic, or policy-violating content in both inputs and outputs.
            Includes 5 built-in categories plus support for custom regex patterns.
          </p>
          <OptionTable
            options={[
              { name: 'enabled', type: 'boolean', default: 'true', description: 'Toggle content filtering on/off.' },
              { name: 'categories', type: 'string[]', default: 'all 5', description: 'Which categories to check. See table below.' },
              { name: activeTab === 'node' ? 'customPatterns' : 'custom_patterns', type: 'CustomPattern[]', default: '—', description: 'Additional regex rules with name, pattern, and severity.' },
              { name: activeTab === 'node' ? 'blockOnViolation' : 'block_on_violation', type: 'boolean', default: 'false', description: 'Throw ContentViolationError when content violates policy.' },
              { name: activeTab === 'node' ? 'onViolation' : 'on_violation', type: 'callback', default: '—', description: 'Called on violation. Receives ContentViolation object.' },
            ]}
          />

          <h4 className="mt-6 text-sm font-semibold text-gray-800">Content Categories</h4>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
            {['hate_speech', 'sexual', 'violence', 'self_harm', 'illegal'].map((c) => (
              <code key={c} className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">{c}</code>
            ))}
          </div>

          <CodeTabs
            nodeCode={CONTENT_NODE}
            pythonCode={CONTENT_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </SubSection>

        {/* ── Model Policy ───────────────────────────────────────────────── */}
        <SubSection id="model-policy" title="Model Policy">
          <p>
            Pre-call guard that validates LLM request parameters against a configurable policy.
            Runs first in the pipeline, before any other security checks.
          </p>
          <OptionTable
            options={[
              { name: activeTab === 'node' ? 'allowedModels' : 'allowed_models', type: 'string[]', default: '—', description: 'Whitelist of model IDs. Calls to other models are blocked.' },
              { name: activeTab === 'node' ? 'maxTokens' : 'max_tokens', type: 'number', default: '—', description: 'Cap on the max_tokens parameter. Requests exceeding this are blocked.' },
              { name: activeTab === 'node' ? 'maxTemperature' : 'max_temperature', type: 'number', default: '—', description: 'Cap on the temperature parameter.' },
              { name: activeTab === 'node' ? 'blockSystemPromptOverride' : 'block_system_prompt_override', type: 'boolean', default: 'false', description: 'Reject requests that include a system message.' },
              { name: activeTab === 'node' ? 'onViolation' : 'on_violation', type: 'callback', default: '—', description: 'Called when a policy violation is detected, receives ModelPolicyViolation.' },
            ]}
          />

          <h4 className="mt-6 text-sm font-semibold text-gray-800">Violation Rules</h4>
          <div className="mt-2 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Rule</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Triggered When</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                <tr><td className="px-3 py-2 font-mono">model_not_allowed</td><td className="px-3 py-2">Requested model is not in the allowedModels whitelist</td></tr>
                <tr><td className="px-3 py-2 font-mono">max_tokens_exceeded</td><td className="px-3 py-2">max_tokens parameter exceeds the policy maxTokens</td></tr>
                <tr><td className="px-3 py-2 font-mono">temperature_exceeded</td><td className="px-3 py-2">temperature parameter exceeds the policy maxTemperature</td></tr>
                <tr><td className="px-3 py-2 font-mono">system_prompt_blocked</td><td className="px-3 py-2">Request includes a system message and blockSystemPromptOverride is true</td></tr>
              </tbody>
            </table>
          </div>

          <CodeTabs
            nodeCode={MODEL_POLICY_NODE}
            pythonCode={MODEL_POLICY_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </SubSection>

        {/* ── Output Schema Validation ───────────────────────────────────── */}
        <SubSection id="output-schema" title="Output Schema Validation">
          <p>
            Validates LLM JSON output against a JSON Schema (Draft-07 subset). Useful for
            structured output workflows where you need guaranteed response formats.
          </p>
          <OptionTable
            options={[
              { name: 'schema', type: 'JsonSchema', default: '—', description: 'The JSON schema to validate against. See supported keywords below.' },
              { name: activeTab === 'node' ? 'blockOnInvalid' : 'block_on_invalid', type: 'boolean', default: 'false', description: 'Throw OutputSchemaError if validation fails.' },
              { name: activeTab === 'node' ? 'onInvalid' : 'on_invalid', type: 'callback', default: '—', description: 'Called when validation fails. Receives array of SchemaValidationError.' },
            ]}
          />

          <h4 className="mt-6 text-sm font-semibold text-gray-800">Supported JSON Schema Keywords</h4>
          <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
            {[
              'type', 'properties', 'required', 'items', 'enum', 'const',
              'minimum', 'maximum', 'minLength', 'maxLength', 'pattern',
              'minItems', 'maxItems', 'additionalProperties',
              'oneOf', 'anyOf', 'allOf', 'not',
            ].map((k) => (
              <code key={k} className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">{k}</code>
            ))}
          </div>

          <InfoBox variant="tip" title="Non-streaming only">
            <p>
              Schema validation runs after the full response is received. It does not
              apply to streaming responses. For streaming, use the Stream Guard instead.
            </p>
          </InfoBox>

          <CodeTabs
            nodeCode={SCHEMA_NODE}
            pythonCode={SCHEMA_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </SubSection>

        {/* ── Stream Guard ───────────────────────────────────────────────── */}
        <SubSection id="stream-guard" title="Stream Guard">
          <p>
            Real-time security scanning for streaming LLM responses. Uses a rolling
            window approach to scan chunks as they arrive, without waiting for
            the full response. Can abort the stream mid-flight if a violation is detected.
          </p>
          <OptionTable
            options={[
              { name: activeTab === 'node' ? 'piiScan' : 'pii_scan', type: 'boolean', default: 'auto', description: 'Enable mid-stream PII scanning. Defaults to true when security.pii is configured.' },
              { name: activeTab === 'node' ? 'injectionScan' : 'injection_scan', type: 'boolean', default: 'auto', description: 'Enable mid-stream injection scanning. Defaults to true when security.injection is configured.' },
              { name: activeTab === 'node' ? 'scanInterval' : 'scan_interval', type: 'number', default: '500', description: 'Characters between periodic scans.' },
              { name: activeTab === 'node' ? 'windowOverlap' : 'window_overlap', type: 'number', default: '200', description: 'Overlap in characters when the rolling window advances. Prevents missing PII that spans chunk boundaries.' },
              { name: activeTab === 'node' ? 'onViolation' : 'on_violation', type: 'string', default: '"flag"', description: '"abort" stops the stream. "warn" fires callback. "flag" adds to final report.' },
              { name: activeTab === 'node' ? 'finalScan' : 'final_scan', type: 'boolean', default: 'true', description: 'Run a full-text scan after the stream completes.' },
              { name: activeTab === 'node' ? 'trackTokens' : 'track_tokens', type: 'boolean', default: 'true', description: 'Enable approximate token counting (chars / 4).' },
              { name: activeTab === 'node' ? 'maxResponseLength' : 'max_response_length', type: 'object', default: '—', description: 'Response length limits: { maxChars, maxWords }. Stream aborts if exceeded.' },
              { name: activeTab === 'node' ? 'onStreamViolation' : 'on_stream_violation', type: 'callback', default: '—', description: 'Called per violation during streaming. Receives StreamViolation.' },
            ]}
          />

          <InfoBox variant="info" title="How rolling window scanning works">
            <p>
              The stream guard accumulates text in a buffer. Every <code className="rounded bg-gray-100 px-1 text-xs">scanInterval</code> characters,
              it scans the latest window. The <code className="rounded bg-gray-100 px-1 text-xs">windowOverlap</code> ensures
              PII or injection patterns that span chunk boundaries are caught. After the stream ends,
              a <code className="rounded bg-gray-100 px-1 text-xs">finalScan</code> of the complete response runs.
            </p>
          </InfoBox>

          <CodeTabs
            nodeCode={STREAM_NODE}
            pythonCode={STREAM_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </SubSection>

        {/* ── Audit ──────────────────────────────────────────────────────── */}
        <SubSection id="audit" title="Audit">
          <p>
            Controls the verbosity of security audit logging attached to events sent to the dashboard.
          </p>
          <OptionTable
            options={[
              { name: activeTab === 'node' ? 'logLevel' : 'log_level', type: 'string', default: '"none"', description: '"none" = no audit data. "summary" = guardrail results only. "detailed" = full input/output included.' },
            ]}
          />
        </SubSection>

        {/* ── Provider Wrappers ──────────────────────────────────────────── */}
        <Section id="providers" title="Provider Wrappers">
          <p>
            LaunchPromptly wraps your LLM client so all API calls pass through the
            security pipeline automatically. Each provider has a dedicated wrapper
            that understands the provider&apos;s API format.
          </p>
        </Section>

        <SubSection id="provider-openai" title="OpenAI">
          <p>
            Intercepts <code className="rounded bg-gray-100 px-1 text-xs">chat.completions.create()</code> for
            both regular and streaming calls. Also scans tool definitions and tool call arguments for PII.
          </p>
          <CodeTabs
            nodeCode={PROVIDER_OPENAI_NODE}
            pythonCode={PROVIDER_OPENAI_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </SubSection>

        <SubSection id="provider-anthropic" title="Anthropic">
          <p>
            Intercepts <code className="rounded bg-gray-100 px-1 text-xs">messages.create()</code>.
            Handles the Anthropic-specific <code className="rounded bg-gray-100 px-1 text-xs">system</code> field
            (top-level, not in messages array). Supports streaming.
          </p>
          <CodeTabs
            nodeCode={PROVIDER_ANTHROPIC_NODE}
            pythonCode={PROVIDER_ANTHROPIC_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </SubSection>

        <SubSection id="provider-gemini" title="Gemini">
          <p>
            Intercepts <code className="rounded bg-gray-100 px-1 text-xs">generateContent()</code> and{' '}
            <code className="rounded bg-gray-100 px-1 text-xs">generateContentStream()</code>.
            Maps Gemini&apos;s <code className="rounded bg-gray-100 px-1 text-xs">maxOutputTokens</code> to the standard max_tokens for cost calculation.
          </p>
          <CodeTabs
            nodeCode={PROVIDER_GEMINI_NODE}
            pythonCode={PROVIDER_GEMINI_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </SubSection>

        {/* ── Context Propagation ────────────────────────────────────────── */}
        <Section id="context" title="Context Propagation">
          <p>
            Attach request context (trace IDs, customer IDs, feature names) that propagates
            through async operations. This context is included in events sent to the dashboard,
            making it easy to correlate LLM calls with your application&apos;s request lifecycle.
          </p>
          <OptionTable
            options={[
              { name: activeTab === 'node' ? 'traceId' : 'trace_id', type: 'string', default: '—', description: 'Unique request identifier for distributed tracing.' },
              { name: activeTab === 'node' ? 'spanName' : 'span_name', type: 'string', default: '—', description: 'Name of the current span / operation.' },
              { name: activeTab === 'node' ? 'customerId' : 'customer_id', type: 'string', default: '—', description: 'End-user identifier for per-customer analytics.' },
              { name: 'feature', type: 'string', default: '—', description: 'Feature or module name (e.g., "chat", "search").' },
              { name: 'metadata', type: 'Record<string, string>', default: '—', description: 'Arbitrary key-value pairs attached to events.' },
            ]}
          />
          <InfoBox variant="tip" title={activeTab === 'node' ? 'AsyncLocalStorage' : 'contextvars'}>
            <p>
              {activeTab === 'node'
                ? 'Node.js uses AsyncLocalStorage under the hood, so context propagates across await boundaries without manual threading.'
                : 'Python uses contextvars.ContextVar, so context propagates correctly through async/await and with-statement blocks.'}
            </p>
          </InfoBox>
          <CodeTabs
            nodeCode={CONTEXT_NODE}
            pythonCode={CONTEXT_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </Section>

        {/* ── Singleton Pattern ──────────────────────────────────────────── */}
        <Section id="singleton" title="Singleton Pattern">
          <p>
            Initialize once at app startup, then access the shared instance from anywhere.
            No need to pass the LaunchPromptly instance through your dependency chain.
          </p>
          <OptionTable
            options={[
              { name: activeTab === 'node' ? 'LaunchPromptly.init(opts)' : 'LaunchPromptly.init(**kwargs)', type: '—', default: '—', description: 'Create and return the singleton instance.' },
              { name: activeTab === 'node' ? 'LaunchPromptly.shared' : 'LaunchPromptly.shared()', type: '—', default: '—', description: 'Access the singleton. Throws if init() has not been called.' },
              { name: 'LaunchPromptly.reset()', type: '—', default: '—', description: 'Destroy the singleton and allow re-initialization.' },
            ]}
          />
          <CodeTabs
            nodeCode={SINGLETON_NODE}
            pythonCode={SINGLETON_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </Section>

        {/* ── Guardrail Events ───────────────────────────────────────────── */}
        <Section id="events" title="Guardrail Events">
          <p>
            Register callbacks that fire when security checks trigger. These are useful
            for logging, alerting, or custom side effects. Handlers never throw &mdash;
            errors in callbacks are silently caught to avoid disrupting the LLM call.
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Event</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Fires When</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Data Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                <tr><td className="px-3 py-2 font-mono">pii.detected</td><td className="px-3 py-2">PII found in input or output</td><td className="px-3 py-2">detections[], direction</td></tr>
                <tr><td className="px-3 py-2 font-mono">pii.redacted</td><td className="px-3 py-2">PII was redacted before LLM call</td><td className="px-3 py-2">strategy, count</td></tr>
                <tr><td className="px-3 py-2 font-mono">injection.detected</td><td className="px-3 py-2">Injection risk score &gt; 0</td><td className="px-3 py-2">riskScore, triggered[], action</td></tr>
                <tr><td className="px-3 py-2 font-mono">injection.blocked</td><td className="px-3 py-2">Injection blocked (score &gt;= threshold)</td><td className="px-3 py-2">riskScore, triggered[]</td></tr>
                <tr><td className="px-3 py-2 font-mono">cost.exceeded</td><td className="px-3 py-2">Budget limit hit</td><td className="px-3 py-2">violation: {'{type, currentSpend, limit}'}</td></tr>
                <tr><td className="px-3 py-2 font-mono">content.violated</td><td className="px-3 py-2">Content filter triggered</td><td className="px-3 py-2">violations: [{'{category, severity, location}'}]</td></tr>
                <tr><td className="px-3 py-2 font-mono">schema.invalid</td><td className="px-3 py-2">Output schema validation failed</td><td className="px-3 py-2">errors: [{'{path, message}'}]</td></tr>
                <tr><td className="px-3 py-2 font-mono">model.blocked</td><td className="px-3 py-2">Model policy violation</td><td className="px-3 py-2">violation: {'{rule, message}'}</td></tr>
              </tbody>
            </table>
          </div>
          <CodeTabs
            nodeCode={EVENTS_NODE}
            pythonCode={EVENTS_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </Section>

        {/* ── Error Classes ──────────────────────────────────────────────── */}
        <Section id="errors" title="Error Classes">
          <p>
            Each security module throws a specific error class when it blocks a request.
            Catch these to handle violations gracefully in your application.
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Error Class</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Thrown By</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Key Properties</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                <tr><td className="px-3 py-2 font-mono">PromptInjectionError</td><td className="px-3 py-2">Injection detection</td><td className="px-3 py-2">.analysis {'{riskScore, triggered, action}'}</td></tr>
                <tr><td className="px-3 py-2 font-mono">CostLimitError</td><td className="px-3 py-2">Cost guard</td><td className="px-3 py-2">.violation {'{type, currentSpend, limit}'}</td></tr>
                <tr><td className="px-3 py-2 font-mono">ContentViolationError</td><td className="px-3 py-2">Content filter</td><td className="px-3 py-2">.violations [{'{category, matched, severity}'}]</td></tr>
                <tr><td className="px-3 py-2 font-mono">ModelPolicyError</td><td className="px-3 py-2">Model policy</td><td className="px-3 py-2">.violation {'{rule, message, actual, limit}'}</td></tr>
                <tr><td className="px-3 py-2 font-mono">OutputSchemaError</td><td className="px-3 py-2">Schema validation</td><td className="px-3 py-2">.validationErrors, .responseText</td></tr>
                <tr><td className="px-3 py-2 font-mono">StreamAbortError</td><td className="px-3 py-2">Stream guard</td><td className="px-3 py-2">.violation, .partialResponse, .approximateTokens</td></tr>
              </tbody>
            </table>
          </div>
          <CodeTabs
            nodeCode={ERRORS_NODE}
            pythonCode={ERRORS_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </Section>

        {/* ── ML-Enhanced Detection ──────────────────────────────────────── */}
        <Section id="ml" title="ML-Enhanced Detection">
          <p>
            Optional ML models that run locally alongside the built-in regex engine.
            Both detection layers merge their results, giving you higher accuracy without
            sacrificing the speed of regex-based detection.
          </p>
          <InfoBox variant="tip" title="Layered defense">
            <p>
              <strong>Layer 1 (always on):</strong> Regex/rules &mdash; zero dependencies, microseconds, catches obvious patterns.<br />
              <strong>Layer 2 (opt-in):</strong> Local ML via ONNX &mdash; no cloud calls, &lt;100ms, catches obfuscated attacks and nuanced hate speech.
            </p>
          </InfoBox>
          <div className="mt-3 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Detector</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Model</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Plugs Into</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                <tr>
                  <td className="px-3 py-2 font-mono">{activeTab === 'node' ? 'MLToxicityDetector' : 'MLToxicityDetector'}</td>
                  <td className="px-3 py-2">Xenova/toxic-bert</td>
                  <td className="px-3 py-2">contentFilter.providers</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono">{activeTab === 'node' ? 'MLInjectionDetector' : 'MLInjectionDetector'}</td>
                  <td className="px-3 py-2">protectai/deberta-v3</td>
                  <td className="px-3 py-2">injection.providers</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono">{activeTab === 'node' ? 'MLPIIDetector' : 'PresidioPIIDetector'}</td>
                  <td className="px-3 py-2">{activeTab === 'node' ? 'NER (person, org, location)' : 'Microsoft Presidio + spaCy'}</td>
                  <td className="px-3 py-2">pii.providers</td>
                </tr>
              </tbody>
            </table>
          </div>
          <CodeTabs
            nodeCode={ML_NODE}
            pythonCode={ML_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </Section>

        {/* ── Lifecycle Methods ──────────────────────────────────────────── */}
        <Section id="lifecycle" title="Lifecycle Methods">
          <p>
            Manage event flushing and cleanup. Always call <code className="rounded bg-gray-100 px-1 text-xs">shutdown()</code> or{' '}
            <code className="rounded bg-gray-100 px-1 text-xs">flush()</code> before
            your process exits to avoid losing pending events.
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Method</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                <tr><td className="px-3 py-2 font-mono">flush()</td><td className="px-3 py-2">Send all pending events to the API. Returns a promise.</td></tr>
                <tr><td className="px-3 py-2 font-mono">destroy()</td><td className="px-3 py-2">Stop timers and discard pending events. Synchronous.</td></tr>
                <tr><td className="px-3 py-2 font-mono">shutdown()</td><td className="px-3 py-2">Flush pending events, then destroy. Graceful shutdown.</td></tr>
                <tr><td className="px-3 py-2 font-mono">{activeTab === 'node' ? 'isDestroyed' : 'is_destroyed'}</td><td className="px-3 py-2">Boolean property. True after destroy() or shutdown() is called.</td></tr>
              </tbody>
            </table>
          </div>
          <CodeTabs
            nodeCode={LIFECYCLE_NODE}
            pythonCode={LIFECYCLE_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </Section>

        {/* ── Security Pipeline Order ────────────────────────────────────── */}
        <Section id="pipeline" title="Security Pipeline Order">
          <p>
            When you call <code className="rounded bg-gray-100 px-1 text-xs">openai.chat.completions.create()</code> through a wrapped client,
            these steps run in order. Each step can block the request or modify the data before passing it to the next.
          </p>
          <div className="mt-4 space-y-2">
            {[
              { n: 1, label: 'Model Policy Check', desc: 'Block disallowed models, enforce token/temperature limits' },
              { n: 2, label: 'Cost Guard Pre-Check', desc: 'Estimate cost and check against all budget limits' },
              { n: 3, label: 'PII Detection (input)', desc: 'Scan messages for emails, SSNs, credit cards, etc.' },
              { n: 4, label: 'PII Redaction (input)', desc: 'Replace PII with placeholders, synthetic data, or hashes' },
              { n: 5, label: 'Injection Detection', desc: 'Score input for prompt injection risk, block if above threshold' },
              { n: 6, label: 'Content Filter (input)', desc: 'Check for hate speech, violence, and custom patterns' },
              { n: 7, label: 'LLM API Call', desc: 'Forward the (possibly modified) request to the LLM provider' },
              { n: 8, label: 'Content Filter (output)', desc: 'Scan the LLM response for policy violations' },
              { n: 9, label: 'Schema Validation', desc: 'Validate JSON output against your schema' },
              { n: 10, label: 'PII Detection (output)', desc: 'Scan response for PII leakage if scanResponse is enabled' },
              { n: 11, label: 'De-redaction', desc: 'Restore original values in the response (placeholder/synthetic/hash)' },
              { n: 12, label: 'Cost Guard Record', desc: 'Record actual cost from usage data' },
              { n: 13, label: 'Event Batching', desc: 'Queue event for dashboard reporting' },
            ].map((step) => (
              <div key={step.n} className="flex items-start gap-3 rounded-lg border bg-white px-4 py-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                  {step.n}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{step.label}</p>
                  <p className="text-xs text-gray-500">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <InfoBox variant="info" title="Streaming">
            <p>
              For streaming calls, steps 7-10 are handled by the Stream Guard engine,
              which scans chunks in real-time using a rolling window. The final scan after
              the stream completes covers the full response text.
            </p>
          </InfoBox>
        </Section>

        {/* Bottom spacer */}
        <div className="h-32" />
      </div>
    </div>
  );
}

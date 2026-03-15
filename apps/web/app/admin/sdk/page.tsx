'use client';

import { useState } from 'react';
import Link from 'next/link';

const INSTALL_CMD = 'npm install launchpromptly';
const INSTALL_CMD_PY = 'pip install launchpromptly';

const BASIC_SECURITY_CODE = `import { LaunchPromptly } from 'launchpromptly';
import OpenAI from 'openai';

const lp = new LaunchPromptly({
  apiKey: 'YOUR_API_KEY_HERE',
  endpoint: 'http://localhost:3001', // your LaunchPromptly API
  security: {
    pii: { enabled: true, redaction: 'placeholder' },
    injection: { enabled: true, blockOnHighRisk: true },
    costGuard: { maxCostPerRequest: 0.50 },
  },
});

// Wrap your OpenAI client — all security features activate automatically
const openai = lp.wrap(new OpenAI(), {
  customer: () => ({ id: getCurrentUser().id }),
  feature: 'chat',
});

// Use openai as normal — PII is redacted, injections are blocked
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: userInput }],
});
// If userInput contains "john@acme.com", the LLM receives "[EMAIL_1]"
// The response is de-redacted before being returned to your code

await lp.flush(); // On server shutdown`;

const FULL_SECURITY_CODE = `const lp = new LaunchPromptly({
  apiKey: process.env.LP_KEY,
  security: {
    // PII Redaction — 16 built-in regex patterns
    pii: {
      enabled: true,
      redaction: 'placeholder',  // or 'synthetic' | 'hash'
      types: ['email', 'phone', 'ssn', 'credit_card', 'ip_address'],
      scanResponse: true,  // also scan LLM responses for PII leakage
      onDetect: (detections) => console.log(\`Found \${detections.length} PII entities\`),
    },
    // Prompt Injection Detection
    injection: {
      enabled: true,
      blockThreshold: 0.7,     // 0-1 risk score threshold
      blockOnHighRisk: true,   // throw PromptInjectionError above threshold
      onDetect: (analysis) => console.log(\`Injection risk: \${analysis.riskScore}\`),
    },
    // Jailbreak Detection — DAN prompts, persona hijacking
    jailbreak: {
      enabled: true,
      blockThreshold: 0.7,     // 0-1 score threshold
      blockOnDetection: true,  // throw JailbreakError above threshold
      onDetect: (result) => console.log(\`Jailbreak score: \${result.score}\`),
    },
    // Prompt Leakage Detection — catch system prompt leaks in output
    promptLeakage: {
      enabled: true,
      systemPrompt: 'You are a helpful assistant',
      blockOnLeak: true,
    },
    // Unicode Sanitizer — strip zero-width chars, homoglyphs
    unicodeSanitizer: {
      enabled: true,
      stripZeroWidth: true,    // remove zero-width joiners/spaces
      normalizeHomoglyphs: true,
      stripBidiOverrides: true,
    },
    // Secret Detection — AWS keys, JWTs, GitHub tokens
    secretDetection: {
      enabled: true,
      action: 'block',          // 'warn' | 'block' | 'redact'
      scanResponse: true,       // also scan LLM output
    },
    // Topic Guard — allowed/blocked conversation topics
    topicGuard: {
      blockedTopics: ['competitors', 'internal-roadmap'],
      allowedTopics: ['product-support', 'billing', 'technical-help'],
      blockOnViolation: true,
    },
    // Output Safety Scanning — scan LLM responses before delivery
    outputSafety: {
      enabled: true,
      scanForPII: true,        // defense-in-depth PII check
      scanForHarm: true,       // harmful content in responses
      scanForCodeInjection: true,
    },
    // Cost Controls
    costGuard: {
      maxCostPerRequest: 1.00,     // USD
      maxCostPerMinute: 10.00,     // USD
      maxCostPerHour: 50.00,       // USD
      maxCostPerCustomer: 5.00,    // USD/hour
      maxTokensPerRequest: 100000,
      blockOnExceed: true,
    },
    // Content Filtering
    contentFilter: {
      enabled: true,
      categories: ['hate_speech', 'violence', 'self_harm'],
      blockOnViolation: false,  // warn only, don't block
      customPatterns: [
        { name: 'competitor_mention', pattern: /competitor_name/i, severity: 'warn' },
      ],
    },
  },
});`;

const PYTHON_CODE = `from launchpromptly import LaunchPromptly
from openai import OpenAI

lp = LaunchPromptly(
    api_key="YOUR_API_KEY_HERE",
    security={
        "pii": {"enabled": True, "redaction": "placeholder"},
        "injection": {"enabled": True, "block_on_high_risk": True},
        "cost_guard": {"max_cost_per_request": 0.50},
    },
)

openai = lp.wrap(OpenAI())

response = openai.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": user_input}],
)
# PII is redacted before the API call, response is de-redacted after`;

const ML_PLUGIN_CODE_NODE = `// ML-enhanced detection (Node.js) — included on all plans
import { LaunchPromptly } from 'launchpromptly';
import { MLToxicityDetector, MLInjectionDetector, MLPIIDetector } from 'launchpromptly/ml';

// Load models (async — first run downloads from HuggingFace, ~8-20ms inference after)
const [toxicity, injection, pii] = await Promise.all([
  MLToxicityDetector.create(),     // toxic-bert (~170MB, quantized)
  MLInjectionDetector.create(),    // Prompt-Guard-86M (~86MB, quantized)
  MLPIIDetector.create(),          // bert-base-NER (~170MB, quantized)
]);

const lp = new LaunchPromptly({
  apiKey: process.env.LP_KEY,
  security: {
    pii: {
      enabled: true,
      redaction: 'placeholder',
      providers: [pii],       // NER: person names, orgs, locations
    },
    injection: {
      enabled: true,
      providers: [injection], // Semantic injection detection
    },
    contentFilter: {
      enabled: true,
      providers: [toxicity],  // ML toxicity: hate speech, threats
    },
  },
});`;

const ML_PLUGIN_CODE_PYTHON = `# ML-enhanced detection (Python) — included on all plans
from launchpromptly import LaunchPromptly
from launchpromptly.ml import MLToxicityDetector, MLInjectionDetector, PresidioPIIDetector

toxicity = MLToxicityDetector()     # toxic-bert (quantized, ~8-20ms inference)
injection = MLInjectionDetector()   # Prompt-Guard-86M (quantized)
pii = PresidioPIIDetector()         # Microsoft Presidio + spaCy NER

lp = LaunchPromptly(
    api_key="lp_live_...",
    security={
        "pii": {
            "enabled": True,
            "redaction": "placeholder",
            "providers": [pii],       # NER: person names, orgs, locations
        },
        "injection": {
            "enabled": True,
            "providers": [injection], # Semantic injection detection
        },
        "content_filter": {
            "enabled": True,
            "providers": [toxicity],  # ML toxicity: hate speech, threats
        },
    },
)`;

export default function SDKSetupPage() {
  const [copied, setCopied] = useState('');
  const [activeTab, setActiveTab] = useState<'node' | 'python'>('node');

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">SDK Setup</h1>
      <p className="mt-1 text-sm text-gray-500">
        Add LLM security to your application in under 5 minutes.
      </p>

      {/* Step 1 */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">1. Generate an API Key</h2>
        <p className="mt-1 text-sm text-gray-500">
          Go to{' '}
          <Link href="/admin/api-keys" className="text-blue-600 underline">
            API Keys
          </Link>{' '}
          and generate a new key for your environment.
        </p>
      </div>

      {/* Step 2 */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">2. Install the SDK</h2>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setActiveTab('node')}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              activeTab === 'node' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Node.js
          </button>
          <button
            onClick={() => setActiveTab('python')}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              activeTab === 'python' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Python
          </button>
        </div>
        <div className="relative mt-2">
          <pre className="rounded-lg bg-gray-900 p-4 text-sm text-green-400">
            {activeTab === 'node' ? INSTALL_CMD : INSTALL_CMD_PY}
          </pre>
          <button
            onClick={() => copyToClipboard(activeTab === 'node' ? INSTALL_CMD : INSTALL_CMD_PY, 'install')}
            className="absolute right-2 top-2 rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600"
          >
            {copied === 'install' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Step 3 */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">3. Wrap your LLM client with security</h2>
        <p className="mt-1 text-sm text-gray-500">
          Initialize LaunchPromptly with security options and wrap your OpenAI client.
          PII redaction, injection detection, jailbreak defense, secret scanning, and all other guards activate on every call.
        </p>
        <div className="relative mt-2">
          <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-green-400">
            {activeTab === 'node' ? BASIC_SECURITY_CODE : PYTHON_CODE}
          </pre>
          <button
            onClick={() => copyToClipboard(activeTab === 'node' ? BASIC_SECURITY_CODE : PYTHON_CODE, 'basic')}
            className="absolute right-2 top-2 rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600"
          >
            {copied === 'basic' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Step 4 — Full Security Config */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">4. Full Security Configuration (Optional)</h2>
        <p className="mt-1 text-sm text-gray-500">
          Configure all 12 security modules: PII, injection, jailbreak, prompt leakage, unicode sanitizer,
          secret detection, topic guard, output safety, cost limits, and content filtering.
        </p>
        <div className="relative mt-2">
          <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-green-400">
            {FULL_SECURITY_CODE}
          </pre>
          <button
            onClick={() => copyToClipboard(FULL_SECURITY_CODE, 'full')}
            className="absolute right-2 top-2 rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600"
          >
            {copied === 'full' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Step 5 — Server-Side Policies */}
      <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-5">
        <h2 className="text-lg font-semibold">5. Server-Side Policies (Recommended)</h2>
        <p className="mt-1 text-sm text-gray-600">
          Instead of hardcoding security rules in your SDK config, you can manage policies from the dashboard
          and have the SDK fetch them at startup. This lets you update PII types, injection thresholds,
          cost limits, and content filters without redeploying your application.
        </p>
        <div className="relative mt-3">
          <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-green-400">{`const lp = new LaunchPromptly({
  apiKey: process.env.LP_KEY,
  // Omit local "security" config — the SDK will fetch
  // the active policy from your LaunchPromptly project.
  // Any rules you set in Admin → Security → Policies
  // are applied automatically on every LLM call.
});`}</pre>
        </div>
        <p className="mt-3 text-sm text-gray-600">
          Configure your rules in{' '}
          <Link href="/admin/security/policies" className="font-medium text-blue-600 underline">
            Security Policies
          </Link>
          . The SDK calls <code className="rounded bg-gray-200 px-1 text-xs">GET /v1/sdk/policy</code>{' '}
          on init and caches the active policy locally.
          Local SDK config (if provided) is merged on top as an override.
        </p>
      </div>

      {/* Step 6 — ML Plugin */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">6. ML-Enhanced Detection</h2>
        <p className="mt-1 text-sm text-gray-500">
          Add local ML models for NER-based PII detection (person names, orgs, locations),
          semantic injection analysis, and ML-powered toxicity classification.
          All inference runs locally &mdash; no data leaves your infrastructure. Included on all plans.
        </p>

        <div className="relative mt-3">
          <pre className="rounded-lg bg-gray-900 p-4 text-sm text-green-400">
            {activeTab === 'node' ? 'npm install onnxruntime-node @huggingface/transformers' : 'pip install launchpromptly[ml-onnx]'}
          </pre>
          <button
            onClick={() => copyToClipboard(activeTab === 'node' ? 'npm install onnxruntime-node @huggingface/transformers' : 'pip install launchpromptly[ml-onnx]', 'ml-install')}
            className="absolute right-2 top-2 rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600"
          >
            {copied === 'ml-install' ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <div className="relative mt-2">
          <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-green-400">
            {activeTab === 'node' ? ML_PLUGIN_CODE_NODE : ML_PLUGIN_CODE_PYTHON}
          </pre>
          <button
            onClick={() => copyToClipboard(activeTab === 'node' ? ML_PLUGIN_CODE_NODE : ML_PLUGIN_CODE_PYTHON, 'ml')}
            className="absolute right-2 top-2 rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600"
          >
            {copied === 'ml' ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
          <h3 className="text-sm font-semibold text-purple-800">Layered Defense</h3>
          <p className="mt-1 text-sm text-gray-600">
            ML providers <strong>merge with</strong> built-in regex/rule detectors. You get the speed of rules (&lt;1ms)
            with the accuracy of ML (&lt;100ms) &mdash; without sending data to a third-party API.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded bg-white p-2 text-center">
              <div className="font-semibold text-purple-700">MLPIIDetector</div>
              <div className="text-gray-500">Names, orgs, locations</div>
            </div>
            <div className="rounded bg-white p-2 text-center">
              <div className="font-semibold text-purple-700">MLInjectionDetector</div>
              <div className="text-gray-500">Obfuscated attacks</div>
            </div>
            <div className="rounded bg-white p-2 text-center">
              <div className="font-semibold text-purple-700">MLToxicityDetector</div>
              <div className="text-gray-500">Hate speech, threats</div>
            </div>
          </div>
        </div>
      </div>

      {/* Step 7 */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">7. Monitor & Configure</h2>
        <p className="mt-1 text-sm text-gray-500">
          Once events are flowing, check your{' '}
          <Link href="/admin/security" className="text-blue-600 underline">
            Security Dashboard
          </Link>{' '}
          to monitor PII detections and injection attempts. Review the{' '}
          <Link href="/admin/security/audit" className="text-blue-600 underline">
            Audit Log
          </Link>{' '}
          for a complete trail of security decisions, and configure{' '}
          <Link href="/admin/security/policies" className="text-blue-600 underline">
            Security Policies
          </Link>{' '}
          per project.
        </p>
      </div>

      {/* Security Behavior Reference */}
      <div className="mt-10 rounded-lg border bg-blue-50 p-5">
        <h3 className="font-semibold text-gray-900">Security Pipeline Order</h3>
        <p className="mt-1 text-sm text-gray-500">
          On every LLM call, the SDK runs these checks in order:
        </p>
        <ol className="mt-3 space-y-1 text-sm text-gray-600">
          <li className="flex gap-2">
            <span className="font-mono text-blue-600">1.</span> Model policy check (block disallowed models/params)
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-blue-600">2.</span> Cost guard pre-check (estimate cost, check budgets)
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-blue-600">3.</span> Unicode sanitizer (strip zero-width chars, homoglyphs, bidi overrides)
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-blue-600">4.</span> Secret detection (block AWS keys, JWTs, tokens in input)
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-blue-600">5.</span> PII scan &amp; redact (replace PII with placeholders)
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-blue-600">6.</span> Injection detection (score risk, warn/block)
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-blue-600">7.</span> Jailbreak detection (DAN mode, persona hijacking)
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-blue-600">8.</span> Topic guard (check allowed/blocked topics)
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-blue-600">9.</span> Content filter (check input policy violations)
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-blue-600">10.</span> <strong>LLM API Call</strong> (with sanitized, redacted content)
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-blue-600">11.</span> Output safety scan (harmful content, code injection)
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-blue-600">12.</span> Response PII scan (defense-in-depth)
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-blue-600">13.</span> Prompt leakage detection (system prompt leak in response)
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-blue-600">14.</span> Response content filter
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-blue-600">15.</span> Schema validation (enforce JSON structure)
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-blue-600">16.</span> De-redact response (restore original values)
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-blue-600">17.</span> Cost guard record (track actual cost)
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-blue-600">18.</span> Send enriched event to dashboard
          </li>
        </ol>
      </div>
    </div>
  );
}

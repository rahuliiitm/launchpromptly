'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  SECTIONS,
  INSTALL_NODE, INSTALL_PYTHON,
  CONSTRUCTOR_NODE, CONSTRUCTOR_PYTHON,
  WRAP_NODE, WRAP_PYTHON,
  PII_NODE, PII_PYTHON,
  PII_MASK_NODE, PII_MASK_PYTHON,
  INJECTION_NODE, INJECTION_PYTHON,
  COST_NODE, COST_PYTHON,
  CONTENT_NODE, CONTENT_PYTHON,
  MODEL_POLICY_NODE, MODEL_POLICY_PYTHON,
  SCHEMA_NODE, SCHEMA_PYTHON,
  STREAM_NODE, STREAM_PYTHON,
  JAILBREAK_NODE, JAILBREAK_PYTHON,
  UNICODE_NODE, UNICODE_PYTHON,
  SECRET_NODE, SECRET_PYTHON,
  TOPIC_GUARD_NODE, TOPIC_GUARD_PYTHON,
  OUTPUT_SAFETY_NODE, OUTPUT_SAFETY_PYTHON,
  PROMPT_LEAKAGE_NODE, PROMPT_LEAKAGE_PYTHON,
  PROVIDER_OPENAI_NODE, PROVIDER_OPENAI_PYTHON,
  PROVIDER_ANTHROPIC_NODE, PROVIDER_ANTHROPIC_PYTHON,
  PROVIDER_GEMINI_NODE, PROVIDER_GEMINI_PYTHON,
  CONTEXT_NODE, CONTEXT_PYTHON,
  SINGLETON_NODE, SINGLETON_PYTHON,
  EVENTS_NODE, EVENTS_PYTHON,
  ERRORS_NODE, ERRORS_PYTHON,
  ML_NODE, ML_PYTHON,
  LIFECYCLE_NODE, LIFECYCLE_PYTHON,
} from './docs-data';
import {
  CodeTabs, Section, SubSection, OptionTable, InfoBox, SideNav, TabButtons,
} from './docs-components';

interface SDKReferenceContentProps {
  isAdmin?: boolean;
}

export function SDKReferenceContent({ isAdmin = false }: SDKReferenceContentProps) {
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

  const apiKeysLink = isAdmin ? '/admin/api-keys' : '/login';
  const apiKeysLabel = isAdmin ? 'API Keys' : 'Sign up to get your API key';

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
              <Link href={apiKeysLink} className="text-blue-600 underline">
                {apiKeysLabel}
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
              { name: 'on', type: 'object', default: '\u2014', description: 'Guardrail event handlers. See Events section for all event types.' },
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
              { name: 'customer', type: activeTab === 'node' ? '() => CustomerContext' : 'Callable', default: '\u2014', description: 'Function returning { id, feature? }. Called per-request for cost tracking.' },
              { name: 'feature', type: 'string', default: '\u2014', description: 'Feature tag (e.g., "chat", "search") for analytics grouping.' },
              { name: activeTab === 'node' ? 'traceId' : 'trace_id', type: 'string', default: '\u2014', description: 'Request trace ID for distributed tracing.' },
              { name: activeTab === 'node' ? 'spanName' : 'span_name', type: 'string', default: '\u2014', description: 'Span name for tracing context.' },
              { name: 'security', type: 'SecurityOptions', default: '\u2014', description: 'Security configuration. Contains pii, injection, costGuard, contentFilter, modelPolicy, streamGuard, outputSchema, audit.' },
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
            in wrap options accepts fourteen sub-modules. Each can be enabled independently.
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
              { id: 'jailbreak', label: 'Jailbreak Detection' },
              { id: 'unicode-sanitizer', label: 'Unicode Sanitizer' },
              { id: 'secret-detection', label: 'Secret Detection' },
              { id: 'topic-guard', label: 'Topic Guard' },
              { id: 'output-safety', label: 'Output Safety' },
              { id: 'prompt-leakage', label: 'Prompt Leakage' },
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
              { name: 'providers', type: 'Provider[]', default: '\u2014', description: 'Additional ML-based detectors. Results merge with regex.' },
              { name: activeTab === 'node' ? 'onDetect' : 'on_detect', type: 'callback', default: '\u2014', description: 'Called when PII is detected, receives detection array.' },
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
              { name: 'providers', type: 'Provider[]', default: '\u2014', description: 'Additional ML-based detectors. Results merge with rules.' },
              { name: activeTab === 'node' ? 'onDetect' : 'on_detect', type: 'callback', default: '\u2014', description: 'Called when injection risk is detected (any score > 0).' },
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
              { name: activeTab === 'node' ? 'maxCostPerRequest' : 'max_cost_per_request', type: 'number', default: '\u2014', description: 'Maximum USD cost for a single LLM call.' },
              { name: activeTab === 'node' ? 'maxCostPerMinute' : 'max_cost_per_minute', type: 'number', default: '\u2014', description: 'Sliding window: max spend in any 60-second window.' },
              { name: activeTab === 'node' ? 'maxCostPerHour' : 'max_cost_per_hour', type: 'number', default: '\u2014', description: 'Sliding window: max spend in any 60-minute window.' },
              { name: activeTab === 'node' ? 'maxCostPerDay' : 'max_cost_per_day', type: 'number', default: '\u2014', description: '24-hour rolling window: max spend in any 24-hour period.' },
              { name: activeTab === 'node' ? 'maxCostPerCustomer' : 'max_cost_per_customer', type: 'number', default: '\u2014', description: 'Per-customer hourly cap. Requires customer() in wrap options.' },
              { name: activeTab === 'node' ? 'maxCostPerCustomerPerDay' : 'max_cost_per_customer_per_day', type: 'number', default: '\u2014', description: 'Per-customer daily cap. Requires customer() in wrap options.' },
              { name: activeTab === 'node' ? 'maxTokensPerRequest' : 'max_tokens_per_request', type: 'number', default: '\u2014', description: 'Hard cap on max_tokens parameter per request.' },
              { name: activeTab === 'node' ? 'blockOnExceed' : 'block_on_exceed', type: 'boolean', default: 'true', description: 'Throw CostLimitError when any budget limit is exceeded.' },
              { name: activeTab === 'node' ? 'onBudgetExceeded' : 'on_budget_exceeded', type: 'callback', default: '\u2014', description: 'Called when a budget limit is hit, receives BudgetViolation.' },
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
              { name: activeTab === 'node' ? 'customPatterns' : 'custom_patterns', type: 'CustomPattern[]', default: '\u2014', description: 'Additional regex rules with name, pattern, and severity.' },
              { name: activeTab === 'node' ? 'blockOnViolation' : 'block_on_violation', type: 'boolean', default: 'false', description: 'Throw ContentViolationError when content violates policy.' },
              { name: activeTab === 'node' ? 'onViolation' : 'on_violation', type: 'callback', default: '\u2014', description: 'Called on violation. Receives ContentViolation object.' },
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
              { name: activeTab === 'node' ? 'allowedModels' : 'allowed_models', type: 'string[]', default: '\u2014', description: 'Whitelist of model IDs. Calls to other models are blocked.' },
              { name: activeTab === 'node' ? 'maxTokens' : 'max_tokens', type: 'number', default: '\u2014', description: 'Cap on the max_tokens parameter. Requests exceeding this are blocked.' },
              { name: activeTab === 'node' ? 'maxTemperature' : 'max_temperature', type: 'number', default: '\u2014', description: 'Cap on the temperature parameter.' },
              { name: activeTab === 'node' ? 'blockSystemPromptOverride' : 'block_system_prompt_override', type: 'boolean', default: 'false', description: 'Reject requests that include a system message.' },
              { name: activeTab === 'node' ? 'onViolation' : 'on_violation', type: 'callback', default: '\u2014', description: 'Called when a policy violation is detected, receives ModelPolicyViolation.' },
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
              { name: 'schema', type: 'JsonSchema', default: '\u2014', description: 'The JSON schema to validate against. See supported keywords below.' },
              { name: activeTab === 'node' ? 'blockOnInvalid' : 'block_on_invalid', type: 'boolean', default: 'false', description: 'Throw OutputSchemaError if validation fails.' },
              { name: activeTab === 'node' ? 'onInvalid' : 'on_invalid', type: 'callback', default: '\u2014', description: 'Called when validation fails. Receives array of SchemaValidationError.' },
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
              { name: activeTab === 'node' ? 'maxResponseLength' : 'max_response_length', type: 'object', default: '\u2014', description: 'Response length limits: { maxChars, maxWords }. Stream aborts if exceeded.' },
              { name: activeTab === 'node' ? 'onStreamViolation' : 'on_stream_violation', type: 'callback', default: '\u2014', description: 'Called per violation during streaming. Receives StreamViolation.' },
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

        {/* ── Jailbreak Detection ────────────────────────────────────────── */}
        <SubSection id="jailbreak" title="Jailbreak Detection">
          <p>
            Detects known jailbreak templates (DAN, STAN, DUDE, etc.), persona assignment attacks,
            and hypothetical framing techniques. Uses a weighted scoring algorithm that combines
            pattern matches across multiple categories into a single 0-1 risk score.
          </p>
          <OptionTable
            options={[
              { name: 'enabled', type: 'boolean', default: 'true', description: 'Toggle jailbreak detection on/off.' },
              { name: activeTab === 'node' ? 'blockThreshold' : 'block_threshold', type: 'number', default: '0.7', description: 'Risk score at or above which the request is blocked.' },
              { name: activeTab === 'node' ? 'warnThreshold' : 'warn_threshold', type: 'number', default: '0.3', description: 'Risk score at or above which a warning is issued.' },
              { name: activeTab === 'node' ? 'blockOnDetection' : 'block_on_detection', type: 'boolean', default: 'false', description: 'Throw JailbreakError when score >= blockThreshold.' },
              { name: activeTab === 'node' ? 'onDetect' : 'on_detect', type: 'callback', default: '\u2014', description: 'Called when jailbreak patterns are detected. Receives analysis object.' },
            ]}
          />

          <h4 className="mt-6 text-sm font-semibold text-gray-800">Detection Categories</h4>
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
                <tr><td className="px-3 py-2 font-mono">known_template</td><td className="px-3 py-2">0.45</td><td className="px-3 py-2">&quot;DAN mode&quot;, &quot;STAN&quot;, &quot;DUDE&quot;, &quot;AIM&quot;, &quot;Developer Mode&quot;</td></tr>
                <tr><td className="px-3 py-2 font-mono">persona_assignment</td><td className="px-3 py-2">0.35</td><td className="px-3 py-2">&quot;you are now an unrestricted AI&quot;, &quot;pretend you have no limits&quot;</td></tr>
                <tr><td className="px-3 py-2 font-mono">hypothetical_framing</td><td className="px-3 py-2">0.30</td><td className="px-3 py-2">&quot;in a fictional world where&quot;, &quot;imagine you could&quot;, &quot;for educational purposes&quot;</td></tr>
                <tr><td className="px-3 py-2 font-mono">constraint_removal</td><td className="px-3 py-2">0.35</td><td className="px-3 py-2">&quot;ignore your safety guidelines&quot;, &quot;bypass your filters&quot;, &quot;disable content policy&quot;</td></tr>
              </tbody>
            </table>
          </div>

          <CodeTabs
            nodeCode={JAILBREAK_NODE}
            pythonCode={JAILBREAK_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </SubSection>

        {/* ── Unicode Sanitizer ──────────────────────────────────────────── */}
        <SubSection id="unicode-sanitizer" title="Unicode Sanitizer">
          <p>
            Detects and neutralizes Unicode-based attacks that attempt to bypass text-based security checks.
            Catches zero-width characters, bidirectional overrides, and homoglyph substitutions that can
            hide malicious content from other guardrails.
          </p>
          <OptionTable
            options={[
              { name: 'enabled', type: 'boolean', default: 'true', description: 'Toggle Unicode sanitization on/off.' },
              { name: 'action', type: 'string', default: '"strip"', description: '"strip" removes dangerous characters. "warn" flags them. "block" rejects the request.' },
              { name: activeTab === 'node' ? 'detectHomoglyphs' : 'detect_homoglyphs', type: 'boolean', default: 'true', description: 'Detect visually similar characters from different scripts (e.g., Cyrillic "a" vs Latin "a").' },
              { name: activeTab === 'node' ? 'onDetect' : 'on_detect', type: 'callback', default: '\u2014', description: 'Called when Unicode issues are found. Receives result with issues array.' },
            ]}
          />

          <h4 className="mt-6 text-sm font-semibold text-gray-800">Detected Unicode Threats</h4>
          <div className="mt-2 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Threat</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                <tr><td className="px-3 py-2 font-mono">zero_width</td><td className="px-3 py-2">Zero-width spaces, joiners, and non-joiners that split words to evade pattern matching</td></tr>
                <tr><td className="px-3 py-2 font-mono">bidi_override</td><td className="px-3 py-2">Bidirectional text overrides that reverse text rendering direction</td></tr>
                <tr><td className="px-3 py-2 font-mono">homoglyph</td><td className="px-3 py-2">Characters from other scripts that look identical to Latin characters</td></tr>
              </tbody>
            </table>
          </div>

          <InfoBox variant="info" title="Run before other guardrails">
            <p>
              The Unicode sanitizer runs early in the pipeline so that downstream checks
              (injection detection, PII scanning) operate on clean text. Without it, attackers
              can insert zero-width characters to split patterns like &quot;ig&#8203;nore prev&#8203;ious instructions&quot;.
            </p>
          </InfoBox>

          <CodeTabs
            nodeCode={UNICODE_NODE}
            pythonCode={UNICODE_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </SubSection>

        {/* ── Secret Detection ───────────────────────────────────────────── */}
        <SubSection id="secret-detection" title="Secret Detection">
          <p>
            Prevents API keys, tokens, passwords, and other secrets from being sent to or leaked
            by LLM providers. Includes 12 built-in patterns covering major cloud providers and
            services, plus support for custom patterns.
          </p>
          <OptionTable
            options={[
              { name: 'enabled', type: 'boolean', default: 'true', description: 'Toggle secret detection on/off.' },
              { name: activeTab === 'node' ? 'builtInPatterns' : 'built_in_patterns', type: 'boolean', default: 'true', description: 'Use the 12 built-in patterns for common secret types.' },
              { name: activeTab === 'node' ? 'scanResponse' : 'scan_response', type: 'boolean', default: 'false', description: 'Also scan LLM output for leaked secrets.' },
              { name: 'action', type: 'string', default: '"redact"', description: '"redact" replaces secrets with [SECRET_TYPE]. "block" rejects the request. "warn" flags only.' },
              { name: activeTab === 'node' ? 'customPatterns' : 'custom_patterns', type: 'CustomSecretPattern[]', default: '\u2014', description: 'Additional regex patterns with name identifier.' },
              { name: activeTab === 'node' ? 'onDetect' : 'on_detect', type: 'callback', default: '\u2014', description: 'Called when secrets are found. Receives array of secret detections.' },
            ]}
          />

          <h4 className="mt-6 text-sm font-semibold text-gray-800">Built-in Patterns</h4>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
            {[
              'AWS Access Key', 'AWS Secret Key', 'GitHub PAT',
              'GitHub OAuth', 'JWT Token', 'Stripe Key',
              'Slack Token', 'OpenAI Key', 'Google API Key',
              'Private Key', 'Connection String', 'High-Entropy String',
            ].map((p) => (
              <code key={p} className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">{p}</code>
            ))}
          </div>

          <CodeTabs
            nodeCode={SECRET_NODE}
            pythonCode={SECRET_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </SubSection>

        {/* ── Topic Guard ────────────────────────────────────────────────── */}
        <SubSection id="topic-guard" title="Topic Guard">
          <p>
            Constrains conversations to allowed topics and blocks off-topic or sensitive subjects.
            Define allowed and blocked topic lists with keyword matching and configurable thresholds.
            Useful for customer-facing bots that should stay on-topic.
          </p>
          <OptionTable
            options={[
              { name: 'enabled', type: 'boolean', default: 'true', description: 'Toggle topic guard on/off.' },
              { name: activeTab === 'node' ? 'allowedTopics' : 'allowed_topics', type: 'TopicRule[]', default: '\u2014', description: 'Whitelist of topics. Each has name, keywords[], and threshold.' },
              { name: activeTab === 'node' ? 'blockedTopics' : 'blocked_topics', type: 'TopicRule[]', default: '\u2014', description: 'Blacklist of topics. If matched, request is blocked/warned.' },
              { name: 'action', type: 'string', default: '"block"', description: '"block" rejects off-topic requests. "warn" flags them. "redirect" returns a canned response.' },
              { name: activeTab === 'node' ? 'onViolation' : 'on_violation', type: 'callback', default: '\u2014', description: 'Called on topic violation. Receives TopicViolation with topic name and direction.' },
            ]}
          />

          <h4 className="mt-6 text-sm font-semibold text-gray-800">TopicRule Structure</h4>
          <OptionTable
            options={[
              { name: 'name', type: 'string', default: '\u2014', description: 'Human-readable topic name (e.g., "customer_support", "politics").' },
              { name: 'keywords', type: 'string[]', default: '\u2014', description: 'Keywords that indicate this topic. Matched case-insensitively.' },
              { name: 'threshold', type: 'number', default: '0.3', description: 'Minimum keyword density ratio to trigger the topic match.' },
            ]}
          />

          <InfoBox variant="tip" title="Allowed vs Blocked">
            <p>
              If <code className="rounded bg-gray-100 px-1 text-xs">allowedTopics</code> is set, requests that do not match any
              allowed topic are rejected. If only <code className="rounded bg-gray-100 px-1 text-xs">blockedTopics</code> is set,
              all topics are allowed except those explicitly blocked.
            </p>
          </InfoBox>

          <CodeTabs
            nodeCode={TOPIC_GUARD_NODE}
            pythonCode={TOPIC_GUARD_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </SubSection>

        {/* ── Output Safety ──────────────────────────────────────────────── */}
        <SubSection id="output-safety" title="Output Safety">
          <p>
            Scans LLM responses for unsafe or policy-violating content before it reaches your users.
            Goes beyond the input content filter by checking for output-specific risks like
            harmful instructions, bias, hallucination indicators, and unqualified professional advice.
          </p>
          <OptionTable
            options={[
              { name: 'enabled', type: 'boolean', default: 'true', description: 'Toggle output safety scanning on/off.' },
              { name: 'categories', type: 'string[]', default: 'all 5', description: 'Which output safety categories to check. See table below.' },
              { name: 'action', type: 'string', default: '"flag"', description: '"block" throws OutputSafetyError. "warn" fires callback. "flag" adds to event report.' },
              { name: activeTab === 'node' ? 'onViolation' : 'on_violation', type: 'callback', default: '\u2014', description: 'Called on output safety violation. Receives OutputSafetyViolation.' },
            ]}
          />

          <h4 className="mt-6 text-sm font-semibold text-gray-800">Output Safety Categories</h4>
          <div className="mt-2 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Category</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Detects</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                <tr><td className="px-3 py-2 font-mono">harmful_instructions</td><td className="px-3 py-2">Step-by-step guides for dangerous or illegal activities</td></tr>
                <tr><td className="px-3 py-2 font-mono">bias</td><td className="px-3 py-2">Stereotyping, prejudiced generalizations, discriminatory content</td></tr>
                <tr><td className="px-3 py-2 font-mono">hallucination_risk</td><td className="px-3 py-2">Fabricated citations, invented statistics, false authority claims</td></tr>
                <tr><td className="px-3 py-2 font-mono">personal_opinions</td><td className="px-3 py-2">Model expressing personal beliefs or preferences inappropriately</td></tr>
                <tr><td className="px-3 py-2 font-mono">medical_legal_financial</td><td className="px-3 py-2">Unqualified advice in regulated domains without appropriate disclaimers</td></tr>
              </tbody>
            </table>
          </div>

          <CodeTabs
            nodeCode={OUTPUT_SAFETY_NODE}
            pythonCode={OUTPUT_SAFETY_PYTHON}
            activeTab={activeTab}
            copiedCode={copiedCode}
            onCopy={handleCopy}
          />
        </SubSection>

        {/* ── Prompt Leakage ─────────────────────────────────────────────── */}
        <SubSection id="prompt-leakage" title="Prompt Leakage Detection">
          <p>
            Detects when an LLM response contains fragments of your system prompt, preventing
            accidental disclosure of proprietary instructions. Compares response text against
            the system prompt using n-gram similarity scoring.
          </p>
          <OptionTable
            options={[
              { name: activeTab === 'node' ? 'systemPrompt' : 'system_prompt', type: 'string', default: '\u2014', description: 'The system prompt to protect. Response text is compared against this.' },
              { name: 'threshold', type: 'number', default: '0.6', description: 'Similarity score (0-1) above which leakage is detected.' },
              { name: activeTab === 'node' ? 'blockOnLeak' : 'block_on_leak', type: 'boolean', default: 'false', description: 'Throw PromptLeakageError when leakage is detected.' },
              { name: activeTab === 'node' ? 'onDetect' : 'on_detect', type: 'callback', default: '\u2014', description: 'Called when leakage is detected. Receives similarity score and matched fragment.' },
            ]}
          />

          <InfoBox variant="warning" title="Provide your system prompt">
            <p>
              This guard requires your system prompt text to compare against. Without it, leakage
              detection cannot run. The prompt is never sent to external services &mdash; comparison
              happens entirely within the SDK.
            </p>
          </InfoBox>

          <CodeTabs
            nodeCode={PROMPT_LEAKAGE_NODE}
            pythonCode={PROMPT_LEAKAGE_PYTHON}
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
              { name: activeTab === 'node' ? 'traceId' : 'trace_id', type: 'string', default: '\u2014', description: 'Unique request identifier for distributed tracing.' },
              { name: activeTab === 'node' ? 'spanName' : 'span_name', type: 'string', default: '\u2014', description: 'Name of the current span / operation.' },
              { name: activeTab === 'node' ? 'customerId' : 'customer_id', type: 'string', default: '\u2014', description: 'End-user identifier for per-customer analytics.' },
              { name: 'feature', type: 'string', default: '\u2014', description: 'Feature or module name (e.g., "chat", "search").' },
              { name: 'metadata', type: 'Record<string, string>', default: '\u2014', description: 'Arbitrary key-value pairs attached to events.' },
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
              { name: activeTab === 'node' ? 'LaunchPromptly.init(opts)' : 'LaunchPromptly.init(**kwargs)', type: '\u2014', default: '\u2014', description: 'Create and return the singleton instance.' },
              { name: activeTab === 'node' ? 'LaunchPromptly.shared' : 'LaunchPromptly.shared()', type: '\u2014', default: '\u2014', description: 'Access the singleton. Throws if init() has not been called.' },
              { name: 'LaunchPromptly.reset()', type: '\u2014', default: '\u2014', description: 'Destroy the singleton and allow re-initialization.' },
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
                  <td className="px-3 py-2 font-mono">MLToxicityDetector</td>
                  <td className="px-3 py-2">Xenova/toxic-bert</td>
                  <td className="px-3 py-2">contentFilter.providers</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono">MLInjectionDetector</td>
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

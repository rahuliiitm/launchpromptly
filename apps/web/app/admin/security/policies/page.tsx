'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import { PageLoader, Spinner } from '@/components/spinner';

// ── Types ──────────────────────────────────────────────────────────────────

const ALL_PII_TYPES = [
  'email', 'phone', 'ssn', 'credit_card', 'ip_address', 'iban',
  'drivers_license', 'uk_nino', 'nhs_number', 'passport', 'aadhaar',
  'eu_phone', 'us_address', 'api_key', 'date_of_birth', 'medicare',
] as const;

const CONTENT_CATEGORIES = [
  'hate_speech', 'sexual', 'violence', 'self_harm', 'illegal',
] as const;

const REDACTION_STRATEGIES = ['placeholder', 'mask', 'hash', 'none'] as const;

interface CustomPIIPattern {
  name: string;
  pattern: string;
  confidence?: number;
}

interface CustomContentPattern {
  name: string;
  pattern: string;
  severity: 'warn' | 'block';
}

interface CustomSecretPattern {
  name: string;
  pattern: string;
  confidence?: number;
}

interface TopicDefinition {
  name: string;
  keywords: string[];
  threshold?: number;
}

const OUTPUT_SAFETY_CATEGORIES = [
  'dangerous_commands', 'sql_injection', 'suspicious_urls', 'dangerous_code',
] as const;

interface PolicyRules {
  pii?: {
    enabled?: boolean;
    redaction?: string;
    types?: string[];
    scanResponse?: boolean;
    customPatterns?: CustomPIIPattern[];
  };
  injection?: {
    enabled?: boolean;
    blockThreshold?: number;
    blockOnHighRisk?: boolean;
  };
  costGuard?: {
    maxCostPerRequest?: number;
    maxCostPerMinute?: number;
    maxCostPerHour?: number;
    maxCostPerDay?: number;
    maxCostPerCustomer?: number;
    maxTokensPerRequest?: number;
    blockOnExceed?: boolean;
  };
  contentFilter?: {
    enabled?: boolean;
    categories?: string[];
    blockOnViolation?: boolean;
    customPatterns?: CustomContentPattern[];
  };
  modelPolicy?: {
    enabled?: boolean;
    allowedModels?: string[];
    blockedModels?: string[];
  };
  jailbreak?: {
    enabled?: boolean;
    blockThreshold?: number;
    warnThreshold?: number;
    blockOnDetection?: boolean;
  };
  promptLeakage?: {
    enabled?: boolean;
    threshold?: number;
    blockOnLeak?: boolean;
  };
  unicodeSanitizer?: {
    enabled?: boolean;
    action?: 'strip' | 'warn' | 'block';
    detectHomoglyphs?: boolean;
  };
  secretDetection?: {
    enabled?: boolean;
    builtInPatterns?: boolean;
    scanResponse?: boolean;
    action?: 'warn' | 'block' | 'redact';
    customPatterns?: CustomSecretPattern[];
  };
  topicGuard?: {
    enabled?: boolean;
    allowedTopics?: TopicDefinition[];
    blockedTopics?: TopicDefinition[];
    action?: 'warn' | 'block';
  };
  outputSafety?: {
    enabled?: boolean;
    categories?: string[];
    action?: 'warn' | 'block';
  };
}

interface SecurityPolicy {
  id: string;
  projectId: string;
  name: string;
  description: string;
  rules: PolicyRules;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_RULES: PolicyRules = {
  pii: { enabled: true, redaction: 'placeholder', types: ['email', 'phone', 'ssn', 'credit_card', 'ip_address'], scanResponse: true, customPatterns: [] },
  injection: { enabled: true, blockThreshold: 0.7, blockOnHighRisk: true },
  costGuard: { maxCostPerRequest: 1.0, blockOnExceed: true },
  contentFilter: { enabled: false, categories: [], blockOnViolation: false, customPatterns: [] },
  modelPolicy: { enabled: false, allowedModels: [], blockedModels: [] },
  jailbreak: { enabled: true, blockThreshold: 0.7, warnThreshold: 0.3, blockOnDetection: true },
  promptLeakage: { enabled: false, threshold: 0.4, blockOnLeak: false },
  unicodeSanitizer: { enabled: true, action: 'strip', detectHomoglyphs: true },
  secretDetection: { enabled: true, builtInPatterns: true, scanResponse: true, action: 'warn', customPatterns: [] },
  topicGuard: { enabled: false, allowedTopics: [], blockedTopics: [], action: 'block' },
  outputSafety: { enabled: false, categories: [...OUTPUT_SAFETY_CATEGORIES], action: 'warn' },
};

// ── Helper Components ──────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
      >
        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-3">
      <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}

// ── PII Section ────────────────────────────────────────────────────────────

function PIISection({ rules, onChange }: { rules: NonNullable<PolicyRules['pii']>; onChange: (r: NonNullable<PolicyRules['pii']>) => void }) {
  const toggleType = (type: string) => {
    const types = rules.types ?? [];
    onChange({ ...rules, types: types.includes(type) ? types.filter(t => t !== type) : [...types, type] });
  };

  const addPattern = () => {
    onChange({ ...rules, customPatterns: [...(rules.customPatterns ?? []), { name: '', pattern: '', confidence: 0.9 }] });
  };

  const updatePattern = (idx: number, patch: Partial<CustomPIIPattern>) => {
    const patterns = [...(rules.customPatterns ?? [])];
    patterns[idx] = { ...patterns[idx], ...patch } as CustomPIIPattern;
    onChange({ ...rules, customPatterns: patterns });
  };

  const removePattern = (idx: number) => {
    onChange({ ...rules, customPatterns: (rules.customPatterns ?? []).filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="PII Redaction" description="Detect and redact personally identifiable information before it reaches the LLM." />
      <Toggle checked={rules.enabled ?? false} onChange={(v) => onChange({ ...rules, enabled: v })} label="Enable PII redaction" />

      {rules.enabled && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Redaction Strategy</label>
            <select
              value={rules.redaction ?? 'placeholder'}
              onChange={(e) => onChange({ ...rules, redaction: e.target.value })}
              className="rounded border px-3 py-1.5 text-sm"
            >
              {REDACTION_STRATEGIES.map(s => (
                <option key={s} value={s}>{s === 'placeholder' ? 'Placeholder ([EMAIL_1])' : s === 'mask' ? 'Mask (j***@***.com)' : s === 'hash' ? 'Hash (SHA-256)' : 'None (detect only)'}</option>
              ))}
            </select>
          </div>

          <Toggle checked={rules.scanResponse ?? false} onChange={(v) => onChange({ ...rules, scanResponse: v })} label="Also scan LLM responses for PII leakage" />

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Built-in PII Types</label>
            <div className="flex flex-wrap gap-2">
              {ALL_PII_TYPES.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    (rules.types ?? []).includes(type)
                      ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {type.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            <div className="mt-1 flex gap-2">
              <button type="button" onClick={() => onChange({ ...rules, types: [...ALL_PII_TYPES] })} className="text-xs text-blue-600 hover:underline">Select all</button>
              <button type="button" onClick={() => onChange({ ...rules, types: [] })} className="text-xs text-gray-500 hover:underline">Clear all</button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Custom PII Patterns</label>
            {(rules.customPatterns ?? []).map((p, idx) => (
              <div key={idx} className="mb-2 flex items-start gap-2">
                <input
                  type="text"
                  placeholder="Name (e.g. employee_id)"
                  value={p.name}
                  onChange={(e) => updatePattern(idx, { name: e.target.value })}
                  className="w-40 rounded border px-2 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Regex (e.g. EMP-\d{6})"
                  value={p.pattern}
                  onChange={(e) => updatePattern(idx, { pattern: e.target.value })}
                  className="flex-1 rounded border px-2 py-1.5 font-mono text-xs"
                />
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  placeholder="Confidence"
                  value={p.confidence ?? 0.9}
                  onChange={(e) => updatePattern(idx, { confidence: parseFloat(e.target.value) || 0.9 })}
                  className="w-20 rounded border px-2 py-1.5 text-xs"
                />
                <button type="button" onClick={() => removePattern(idx)} className="text-red-500 hover:text-red-700 text-xs mt-1">&times;</button>
              </div>
            ))}
            <button type="button" onClick={addPattern} className="text-xs text-blue-600 hover:underline">+ Add custom pattern</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Injection Section ──────────────────────────────────────────────────────

function InjectionSection({ rules, onChange }: { rules: NonNullable<PolicyRules['injection']>; onChange: (r: NonNullable<PolicyRules['injection']>) => void }) {
  return (
    <div className="space-y-4">
      <SectionHeader title="Prompt Injection Detection" description="Score inputs for injection risk and optionally block high-risk requests." />
      <Toggle checked={rules.enabled ?? false} onChange={(v) => onChange({ ...rules, enabled: v })} label="Enable injection detection" />

      {rules.enabled && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Block Threshold: <span className="font-mono text-blue-600">{rules.blockThreshold ?? 0.7}</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={rules.blockThreshold ?? 0.7}
              onChange={(e) => onChange({ ...rules, blockThreshold: parseFloat(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>0 (very sensitive)</span>
              <span>1 (permissive)</span>
            </div>
          </div>
          <Toggle checked={rules.blockOnHighRisk ?? true} onChange={(v) => onChange({ ...rules, blockOnHighRisk: v })} label="Block requests above threshold (otherwise warn only)" />
        </>
      )}
    </div>
  );
}

// ── Cost Guard Section ─────────────────────────────────────────────────────

function CostGuardSection({ rules, onChange }: { rules: NonNullable<PolicyRules['costGuard']>; onChange: (r: NonNullable<PolicyRules['costGuard']>) => void }) {
  const hasAnyLimit = (rules.maxCostPerRequest ?? 0) > 0 || (rules.maxCostPerHour ?? 0) > 0 || (rules.maxCostPerDay ?? 0) > 0;

  return (
    <div className="space-y-4">
      <SectionHeader title="Cost Guards" description="Set budget limits to prevent runaway LLM spending." />

      <div className="grid grid-cols-2 gap-3">
        {([
          ['maxCostPerRequest', 'Per request ($)'],
          ['maxCostPerMinute', 'Per minute ($)'],
          ['maxCostPerHour', 'Per hour ($)'],
          ['maxCostPerDay', 'Per day ($)'],
          ['maxCostPerCustomer', 'Per customer/hr ($)'],
          ['maxTokensPerRequest', 'Max tokens/request'],
        ] as const).map(([key, label]) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-500">{label}</label>
            <input
              type="number"
              step={key === 'maxTokensPerRequest' ? '1000' : '0.10'}
              min="0"
              value={(rules[key as keyof typeof rules] as number) ?? ''}
              onChange={(e) => onChange({ ...rules, [key]: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="No limit"
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            />
          </div>
        ))}
      </div>

      {hasAnyLimit && (
        <Toggle checked={rules.blockOnExceed ?? true} onChange={(v) => onChange({ ...rules, blockOnExceed: v })} label="Block requests exceeding limits (otherwise warn only)" />
      )}
    </div>
  );
}

// ── Content Filter Section ─────────────────────────────────────────────────

function ContentFilterSection({ rules, onChange }: { rules: NonNullable<PolicyRules['contentFilter']>; onChange: (r: NonNullable<PolicyRules['contentFilter']>) => void }) {
  const toggleCategory = (cat: string) => {
    const cats = rules.categories ?? [];
    onChange({ ...rules, categories: cats.includes(cat) ? cats.filter(c => c !== cat) : [...cats, cat] });
  };

  const addPattern = () => {
    onChange({ ...rules, customPatterns: [...(rules.customPatterns ?? []), { name: '', pattern: '', severity: 'warn' }] });
  };

  const updatePattern = (idx: number, patch: Partial<CustomContentPattern>) => {
    const patterns = [...(rules.customPatterns ?? [])];
    patterns[idx] = { ...patterns[idx], ...patch } as CustomContentPattern;
    onChange({ ...rules, customPatterns: patterns });
  };

  const removePattern = (idx: number) => {
    onChange({ ...rules, customPatterns: (rules.customPatterns ?? []).filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="Content Filtering" description="Block or flag harmful content categories and custom patterns." />
      <Toggle checked={rules.enabled ?? false} onChange={(v) => onChange({ ...rules, enabled: v })} label="Enable content filtering" />

      {rules.enabled && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Categories</label>
            <div className="flex flex-wrap gap-2">
              {CONTENT_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    (rules.categories ?? []).includes(cat)
                      ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {cat.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <Toggle checked={rules.blockOnViolation ?? false} onChange={(v) => onChange({ ...rules, blockOnViolation: v })} label="Block on violation (otherwise warn only)" />

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Custom Patterns</label>
            {(rules.customPatterns ?? []).map((p, idx) => (
              <div key={idx} className="mb-2 flex items-start gap-2">
                <input
                  type="text"
                  placeholder="Name (e.g. competitor_mention)"
                  value={p.name}
                  onChange={(e) => updatePattern(idx, { name: e.target.value })}
                  className="w-44 rounded border px-2 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Regex pattern"
                  value={p.pattern}
                  onChange={(e) => updatePattern(idx, { pattern: e.target.value })}
                  className="flex-1 rounded border px-2 py-1.5 font-mono text-xs"
                />
                <select
                  value={p.severity}
                  onChange={(e) => updatePattern(idx, { severity: e.target.value as 'warn' | 'block' })}
                  className="rounded border px-2 py-1.5 text-xs"
                >
                  <option value="warn">Warn</option>
                  <option value="block">Block</option>
                </select>
                <button type="button" onClick={() => removePattern(idx)} className="text-red-500 hover:text-red-700 text-xs mt-1">&times;</button>
              </div>
            ))}
            <button type="button" onClick={addPattern} className="text-xs text-blue-600 hover:underline">+ Add custom pattern</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Model Policy Section ───────────────────────────────────────────────────

function ModelPolicySection({ rules, onChange }: { rules: NonNullable<PolicyRules['modelPolicy']>; onChange: (r: NonNullable<PolicyRules['modelPolicy']>) => void }) {
  const [newAllowed, setNewAllowed] = useState('');
  const [newBlocked, setNewBlocked] = useState('');

  return (
    <div className="space-y-4">
      <SectionHeader title="Model Policy" description="Restrict which models and providers can be used." />
      <Toggle checked={rules.enabled ?? false} onChange={(v) => onChange({ ...rules, enabled: v })} label="Enable model policy" />

      {rules.enabled && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Allowed Models</label>
            <div className="flex flex-wrap gap-1 mb-1">
              {(rules.allowedModels ?? []).map((m, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs text-green-700">
                  {m}
                  <button type="button" onClick={() => onChange({ ...rules, allowedModels: (rules.allowedModels ?? []).filter((_, j) => j !== i) })} className="hover:text-green-900">&times;</button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                type="text"
                placeholder="e.g. gpt-4o"
                value={newAllowed}
                onChange={(e) => setNewAllowed(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newAllowed.trim()) { e.preventDefault(); onChange({ ...rules, allowedModels: [...(rules.allowedModels ?? []), newAllowed.trim()] }); setNewAllowed(''); } }}
                className="flex-1 rounded border px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={() => { if (newAllowed.trim()) { onChange({ ...rules, allowedModels: [...(rules.allowedModels ?? []), newAllowed.trim()] }); setNewAllowed(''); } }}
                className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
              >Add</button>
            </div>
            <p className="mt-1 text-xs text-gray-400">Leave empty to allow all models.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Blocked Models</label>
            <div className="flex flex-wrap gap-1 mb-1">
              {(rules.blockedModels ?? []).map((m, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs text-red-700">
                  {m}
                  <button type="button" onClick={() => onChange({ ...rules, blockedModels: (rules.blockedModels ?? []).filter((_, j) => j !== i) })} className="hover:text-red-900">&times;</button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                type="text"
                placeholder="e.g. gpt-3.5-turbo"
                value={newBlocked}
                onChange={(e) => setNewBlocked(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newBlocked.trim()) { e.preventDefault(); onChange({ ...rules, blockedModels: [...(rules.blockedModels ?? []), newBlocked.trim()] }); setNewBlocked(''); } }}
                className="flex-1 rounded border px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={() => { if (newBlocked.trim()) { onChange({ ...rules, blockedModels: [...(rules.blockedModels ?? []), newBlocked.trim()] }); setNewBlocked(''); } }}
                className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
              >Add</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Jailbreak Section ─────────────────────────────────────────────────

function JailbreakSection({ rules, onChange }: { rules: NonNullable<PolicyRules['jailbreak']>; onChange: (r: NonNullable<PolicyRules['jailbreak']>) => void }) {
  return (
    <div className="space-y-4">
      <SectionHeader title="Jailbreak Detection" description="Detect DAN attacks, persona hijacking, encoded payloads, and social engineering attempts that bypass injection detection." />
      <Toggle checked={rules.enabled ?? false} onChange={(v) => onChange({ ...rules, enabled: v })} label="Enable jailbreak detection" />

      {rules.enabled && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Block Threshold: <span className="font-mono text-blue-600">{rules.blockThreshold ?? 0.7}</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={rules.blockThreshold ?? 0.7}
              onChange={(e) => onChange({ ...rules, blockThreshold: parseFloat(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>0 (very sensitive)</span>
              <span>1 (permissive)</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Warn Threshold: <span className="font-mono text-amber-600">{rules.warnThreshold ?? 0.3}</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={rules.warnThreshold ?? 0.3}
              onChange={(e) => onChange({ ...rules, warnThreshold: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          <Toggle checked={rules.blockOnDetection ?? true} onChange={(v) => onChange({ ...rules, blockOnDetection: v })} label="Block requests above threshold (otherwise warn only)" />

          <div className="rounded bg-gray-50 p-3 text-xs text-gray-500">
            <p className="font-medium text-gray-700 mb-1">Detection categories:</p>
            <ul className="list-disc ml-4 space-y-0.5">
              <li>Known templates (DAN, STAN, DUDE, AIM, Developer Mode)</li>
              <li>Hypothetical framing (&ldquo;in a fictional world&rdquo;, &ldquo;for educational purposes&rdquo;)</li>
              <li>Persona assignment (&ldquo;you are now an unrestricted AI&rdquo;)</li>
              <li>Payload encoding (base64, ROT13, hex-encoded instructions)</li>
              <li>Few-shot manipulation (fake conversation histories)</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

// ── Prompt Leakage Section ────────────────────────────────────────────

function PromptLeakageSection({ rules, onChange }: { rules: NonNullable<PolicyRules['promptLeakage']>; onChange: (r: NonNullable<PolicyRules['promptLeakage']>) => void }) {
  return (
    <div className="space-y-4">
      <SectionHeader title="Prompt Leakage Detection" description="Detect when LLM outputs contain fragments of your system prompt. Prevents attackers from extracting your instructions." />
      <Toggle checked={rules.enabled ?? false} onChange={(v) => onChange({ ...rules, enabled: v })} label="Enable prompt leakage detection" />

      {rules.enabled && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Similarity Threshold: <span className="font-mono text-blue-600">{rules.threshold ?? 0.4}</span>
            </label>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={rules.threshold ?? 0.4}
              onChange={(e) => onChange({ ...rules, threshold: parseFloat(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>0.1 (very sensitive)</span>
              <span>0.9 (only exact copies)</span>
            </div>
          </div>

          <Toggle checked={rules.blockOnLeak ?? false} onChange={(v) => onChange({ ...rules, blockOnLeak: v })} label="Block response on leak (otherwise warn only)" />

          <div className="rounded bg-gray-50 p-3 text-xs text-gray-500">
            <p className="font-medium text-gray-700 mb-1">Detection methods:</p>
            <ul className="list-disc ml-4 space-y-0.5">
              <li>N-gram overlap between system prompt and LLM output</li>
              <li>Meta-response patterns (&ldquo;my instructions are...&rdquo;, &ldquo;I was told to...&rdquo;)</li>
              <li>Verbatim substring matching (30+ character matches)</li>
            </ul>
            <p className="mt-2 text-amber-600">Note: Set the system prompt in SDK code (not here) to keep it secure.</p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Unicode Sanitizer Section ─────────────────────────────────────────

function UnicodeSanitizerSection({ rules, onChange }: { rules: NonNullable<PolicyRules['unicodeSanitizer']>; onChange: (r: NonNullable<PolicyRules['unicodeSanitizer']>) => void }) {
  return (
    <div className="space-y-4">
      <SectionHeader title="Unicode Sanitizer" description="Strip or detect invisible characters, bidirectional overrides, and homoglyph attacks that hide malicious payloads." />
      <Toggle checked={rules.enabled ?? false} onChange={(v) => onChange({ ...rules, enabled: v })} label="Enable unicode sanitization" />

      {rules.enabled && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
            <select
              value={rules.action ?? 'strip'}
              onChange={(e) => onChange({ ...rules, action: e.target.value as 'strip' | 'warn' | 'block' })}
              className="rounded border px-3 py-1.5 text-sm"
            >
              <option value="strip">Strip (remove threats, continue processing)</option>
              <option value="warn">Warn (log event, continue processing)</option>
              <option value="block">Block (reject the request)</option>
            </select>
          </div>

          <Toggle checked={rules.detectHomoglyphs ?? true} onChange={(v) => onChange({ ...rules, detectHomoglyphs: v })} label="Detect homoglyph attacks (mixed Cyrillic/Latin characters)" />

          <div className="rounded bg-gray-50 p-3 text-xs text-gray-500">
            <p className="font-medium text-gray-700 mb-1">Threat types detected:</p>
            <ul className="list-disc ml-4 space-y-0.5">
              <li>Zero-width characters (U+200B, U+FEFF, etc.)</li>
              <li>Bidirectional overrides (right-to-left text manipulation)</li>
              <li>Tag characters (hidden ASCII in Unicode tags)</li>
              <li>Homoglyphs (Cyrillic characters disguised as Latin)</li>
              <li>Variation selectors (character appearance modifiers)</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

// ── Secret Detection Section ──────────────────────────────────────────

function SecretDetectionSection({ rules, onChange }: { rules: NonNullable<PolicyRules['secretDetection']>; onChange: (r: NonNullable<PolicyRules['secretDetection']>) => void }) {
  const addPattern = () => {
    onChange({ ...rules, customPatterns: [...(rules.customPatterns ?? []), { name: '', pattern: '', confidence: 0.9 }] });
  };

  const updatePattern = (idx: number, patch: Partial<CustomSecretPattern>) => {
    const patterns = [...(rules.customPatterns ?? [])];
    patterns[idx] = { ...patterns[idx], ...patch } as CustomSecretPattern;
    onChange({ ...rules, customPatterns: patterns });
  };

  const removePattern = (idx: number) => {
    onChange({ ...rules, customPatterns: (rules.customPatterns ?? []).filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="Secret & Credential Detection" description="Detect API keys, tokens, private keys, connection strings, and other credentials in inputs and outputs." />
      <Toggle checked={rules.enabled ?? false} onChange={(v) => onChange({ ...rules, enabled: v })} label="Enable secret detection" />

      {rules.enabled && (
        <>
          <Toggle checked={rules.builtInPatterns ?? true} onChange={(v) => onChange({ ...rules, builtInPatterns: v })} label="Use built-in patterns (AWS keys, GitHub PATs, JWTs, Stripe keys, etc.)" />
          <Toggle checked={rules.scanResponse ?? true} onChange={(v) => onChange({ ...rules, scanResponse: v })} label="Also scan LLM responses for leaked secrets" />

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
            <select
              value={rules.action ?? 'warn'}
              onChange={(e) => onChange({ ...rules, action: e.target.value as 'warn' | 'block' | 'redact' })}
              className="rounded border px-3 py-1.5 text-sm"
            >
              <option value="warn">Warn (log event, continue processing)</option>
              <option value="block">Block (reject the request)</option>
              <option value="redact">Redact (replace with [SECRET:type])</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Custom Secret Patterns</label>
            {(rules.customPatterns ?? []).map((p, idx) => (
              <div key={idx} className="mb-2 flex items-start gap-2">
                <input
                  type="text"
                  placeholder="Name (e.g. internal_api_key)"
                  value={p.name}
                  onChange={(e) => updatePattern(idx, { name: e.target.value })}
                  className="w-44 rounded border px-2 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Regex (e.g. MYAPP-[A-Z0-9]{32})"
                  value={p.pattern}
                  onChange={(e) => updatePattern(idx, { pattern: e.target.value })}
                  className="flex-1 rounded border px-2 py-1.5 font-mono text-xs"
                />
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  placeholder="Confidence"
                  value={p.confidence ?? 0.9}
                  onChange={(e) => updatePattern(idx, { confidence: parseFloat(e.target.value) || 0.9 })}
                  className="w-20 rounded border px-2 py-1.5 text-xs"
                />
                <button type="button" onClick={() => removePattern(idx)} className="text-red-500 hover:text-red-700 text-xs mt-1">&times;</button>
              </div>
            ))}
            <button type="button" onClick={addPattern} className="text-xs text-blue-600 hover:underline">+ Add custom pattern</button>
          </div>

          <div className="rounded bg-gray-50 p-3 text-xs text-gray-500">
            <p className="font-medium text-gray-700 mb-1">Built-in patterns (12):</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {['AWS Access Key', 'GitHub PAT', 'GitHub OAuth', 'GitLab PAT', 'Slack Token', 'Stripe Secret', 'Stripe Publishable', 'JWT', 'Private Key', 'Connection String', 'Webhook URL', 'High Entropy Secret'].map(p => (
                <span key={p} className="rounded bg-gray-200 px-2 py-0.5 text-xs">{p}</span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Topic Guard Section ───────────────────────────────────────────────

function TopicGuardSection({ rules, onChange }: { rules: NonNullable<PolicyRules['topicGuard']>; onChange: (r: NonNullable<PolicyRules['topicGuard']>) => void }) {
  const [newKeyword, setNewKeyword] = useState<Record<string, string>>({});

  const addTopic = (list: 'allowedTopics' | 'blockedTopics') => {
    const topics = [...(rules[list] ?? []), { name: '', keywords: [], threshold: 0.05 }];
    onChange({ ...rules, [list]: topics });
  };

  const updateTopic = (list: 'allowedTopics' | 'blockedTopics', idx: number, patch: Partial<TopicDefinition>) => {
    const topics = [...(rules[list] ?? [])];
    topics[idx] = { ...topics[idx], ...patch } as TopicDefinition;
    onChange({ ...rules, [list]: topics });
  };

  const removeTopic = (list: 'allowedTopics' | 'blockedTopics', idx: number) => {
    onChange({ ...rules, [list]: (rules[list] ?? []).filter((_, i) => i !== idx) });
  };

  const addKeyword = (list: 'allowedTopics' | 'blockedTopics', idx: number) => {
    const key = `${list}-${idx}`;
    const kw = (newKeyword[key] ?? '').trim();
    if (!kw) return;
    const topics = [...(rules[list] ?? [])] as TopicDefinition[];
    const topic = topics[idx];
    if (!topic) return;
    topics[idx] = { ...topic, keywords: [...topic.keywords, kw] };
    onChange({ ...rules, [list]: topics });
    setNewKeyword({ ...newKeyword, [key]: '' });
  };

  const removeKeyword = (list: 'allowedTopics' | 'blockedTopics', topicIdx: number, kwIdx: number) => {
    const topics = [...(rules[list] ?? [])] as TopicDefinition[];
    const topic = topics[topicIdx];
    if (!topic) return;
    topics[topicIdx] = { ...topic, keywords: topic.keywords.filter((_, i) => i !== kwIdx) };
    onChange({ ...rules, [list]: topics });
  };

  const renderTopicList = (list: 'allowedTopics' | 'blockedTopics', label: string, color: string) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-2">{label}</label>
      {(rules[list] ?? []).map((topic, idx) => {
        const key = `${list}-${idx}`;
        return (
          <div key={idx} className="mb-3 rounded border p-3">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                placeholder="Topic name"
                value={topic.name}
                onChange={(e) => updateTopic(list, idx, { name: e.target.value })}
                className="flex-1 rounded border px-2 py-1.5 text-xs font-medium"
              />
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-400">Threshold:</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={topic.threshold ?? 0.05}
                  onChange={(e) => updateTopic(list, idx, { threshold: parseFloat(e.target.value) || 0.05 })}
                  className="w-16 rounded border px-2 py-1 text-xs"
                />
              </div>
              <button type="button" onClick={() => removeTopic(list, idx)} className="text-red-500 hover:text-red-700 text-xs">&times;</button>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {topic.keywords.map((kw, kwIdx) => (
                <span key={kwIdx} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ${color}`}>
                  {kw}
                  <button type="button" onClick={() => removeKeyword(list, idx, kwIdx)} className="hover:opacity-70">&times;</button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                type="text"
                placeholder="Add keyword..."
                value={newKeyword[key] ?? ''}
                onChange={(e) => setNewKeyword({ ...newKeyword, [key]: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(list, idx); } }}
                className="flex-1 rounded border px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={() => addKeyword(list, idx)}
                className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
              >Add</button>
            </div>
          </div>
        );
      })}
      <button type="button" onClick={() => addTopic(list)} className="text-xs text-blue-600 hover:underline">+ Add topic</button>
    </div>
  );

  return (
    <div className="space-y-4">
      <SectionHeader title="Topic Guard" description="Restrict conversations to allowed topics or block specific subjects. Configure what your LLM can and cannot discuss." />
      <Toggle checked={rules.enabled ?? false} onChange={(v) => onChange({ ...rules, enabled: v })} label="Enable topic restriction" />

      {rules.enabled && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
            <select
              value={rules.action ?? 'block'}
              onChange={(e) => onChange({ ...rules, action: e.target.value as 'warn' | 'block' })}
              className="rounded border px-3 py-1.5 text-sm"
            >
              <option value="block">Block (reject off-topic requests)</option>
              <option value="warn">Warn (log event, continue processing)</option>
            </select>
          </div>

          {renderTopicList('allowedTopics', 'Allowed Topics (input MUST match at least one)', 'bg-green-100 text-green-700')}
          {renderTopicList('blockedTopics', 'Blocked Topics (input must NOT match any)', 'bg-red-100 text-red-700')}

          {((rules.allowedTopics ?? []).length > 0 || (rules.blockedTopics ?? []).length > 0) && (
            <div className="rounded bg-blue-50 p-3 text-xs text-blue-700">
              <p className="font-medium">Preview:</p>
              {(rules.allowedTopics ?? []).length > 0 && (
                <p>Your chatbot will ONLY discuss: {(rules.allowedTopics ?? []).map(t => t.name || 'Unnamed').join(', ')}</p>
              )}
              {(rules.blockedTopics ?? []).length > 0 && (
                <p>Your chatbot will REFUSE: {(rules.blockedTopics ?? []).map(t => t.name || 'Unnamed').join(', ')}</p>
              )}
              {(rules.allowedTopics ?? []).length > 0 && (rules.blockedTopics ?? []).length > 0 && (
                <p className="mt-1 text-blue-500">Note: If input matches an allowed topic, blocked topics are skipped.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Output Safety Section ─────────────────────────────────────────────

function OutputSafetySection({ rules, onChange }: { rules: NonNullable<PolicyRules['outputSafety']>; onChange: (r: NonNullable<PolicyRules['outputSafety']>) => void }) {
  const toggleCategory = (cat: string) => {
    const cats = rules.categories ?? [];
    onChange({ ...rules, categories: cats.includes(cat) ? cats.filter(c => c !== cat) : [...cats, cat] });
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="Output Safety Scanning" description="Scan LLM responses for dangerous commands, SQL injection payloads, suspicious URLs, and unsafe code patterns." />
      <Toggle checked={rules.enabled ?? false} onChange={(v) => onChange({ ...rules, enabled: v })} label="Enable output safety scanning" />

      {rules.enabled && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Categories</label>
            <div className="flex flex-wrap gap-2">
              {OUTPUT_SAFETY_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    (rules.categories ?? []).includes(cat)
                      ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-300'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {cat.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
            <select
              value={rules.action ?? 'warn'}
              onChange={(e) => onChange({ ...rules, action: e.target.value as 'warn' | 'block' })}
              className="rounded border px-3 py-1.5 text-sm"
            >
              <option value="warn">Warn (log event, continue)</option>
              <option value="block">Block (reject the response)</option>
            </select>
          </div>

          <div className="rounded bg-gray-50 p-3 text-xs text-gray-500">
            <p className="font-medium text-gray-700 mb-1">Examples detected:</p>
            <ul className="list-disc ml-4 space-y-0.5">
              <li><strong>Dangerous commands:</strong> rm -rf /, DROP TABLE, format c:, fork bombs</li>
              <li><strong>SQL injection:</strong> OR 1=1, UNION SELECT, xp_cmdshell</li>
              <li><strong>Suspicious URLs:</strong> bare IP addresses, .onion domains, data: URIs</li>
              <li><strong>Dangerous code:</strong> eval(), exec(), os.system(), child_process</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

// ── Policy Editor ──────────────────────────────────────────────────────────

type PolicyTab = 'pii' | 'injection' | 'costGuard' | 'contentFilter' | 'modelPolicy' | 'jailbreak' | 'promptLeakage' | 'unicodeSanitizer' | 'secretDetection' | 'topicGuard' | 'outputSafety';

function PolicyEditor({ rules, onChange }: { rules: PolicyRules; onChange: (r: PolicyRules) => void }) {
  const [activeTab, setActiveTab] = useState<PolicyTab>('pii');

  const tabs: { key: PolicyTab; label: string; enabled: boolean | undefined }[] = [
    { key: 'pii', label: 'PII', enabled: rules.pii?.enabled },
    { key: 'injection', label: 'Injection', enabled: rules.injection?.enabled },
    { key: 'jailbreak', label: 'Jailbreak', enabled: rules.jailbreak?.enabled },
    { key: 'unicodeSanitizer', label: 'Unicode', enabled: rules.unicodeSanitizer?.enabled },
    { key: 'secretDetection', label: 'Secrets', enabled: rules.secretDetection?.enabled },
    { key: 'topicGuard', label: 'Topics', enabled: rules.topicGuard?.enabled },
    { key: 'contentFilter', label: 'Content', enabled: rules.contentFilter?.enabled },
    { key: 'outputSafety', label: 'Output Safety', enabled: rules.outputSafety?.enabled },
    { key: 'promptLeakage', label: 'Leakage', enabled: rules.promptLeakage?.enabled },
    { key: 'costGuard', label: 'Cost', enabled: (rules.costGuard?.maxCostPerRequest ?? 0) > 0 },
    { key: 'modelPolicy', label: 'Models', enabled: rules.modelPolicy?.enabled },
  ];

  return (
    <div>
      <div className="flex border-b overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`relative shrink-0 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.enabled && (
              <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
            )}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {activeTab === 'pii' && <PIISection rules={rules.pii ?? {}} onChange={(pii) => onChange({ ...rules, pii })} />}
        {activeTab === 'injection' && <InjectionSection rules={rules.injection ?? {}} onChange={(injection) => onChange({ ...rules, injection })} />}
        {activeTab === 'jailbreak' && <JailbreakSection rules={rules.jailbreak ?? {}} onChange={(jailbreak) => onChange({ ...rules, jailbreak })} />}
        {activeTab === 'unicodeSanitizer' && <UnicodeSanitizerSection rules={rules.unicodeSanitizer ?? {}} onChange={(unicodeSanitizer) => onChange({ ...rules, unicodeSanitizer })} />}
        {activeTab === 'secretDetection' && <SecretDetectionSection rules={rules.secretDetection ?? {}} onChange={(secretDetection) => onChange({ ...rules, secretDetection })} />}
        {activeTab === 'topicGuard' && <TopicGuardSection rules={rules.topicGuard ?? {}} onChange={(topicGuard) => onChange({ ...rules, topicGuard })} />}
        {activeTab === 'contentFilter' && <ContentFilterSection rules={rules.contentFilter ?? {}} onChange={(contentFilter) => onChange({ ...rules, contentFilter })} />}
        {activeTab === 'outputSafety' && <OutputSafetySection rules={rules.outputSafety ?? {}} onChange={(outputSafety) => onChange({ ...rules, outputSafety })} />}
        {activeTab === 'promptLeakage' && <PromptLeakageSection rules={rules.promptLeakage ?? {}} onChange={(promptLeakage) => onChange({ ...rules, promptLeakage })} />}
        {activeTab === 'costGuard' && <CostGuardSection rules={rules.costGuard ?? {}} onChange={(costGuard) => onChange({ ...rules, costGuard })} />}
        {activeTab === 'modelPolicy' && <ModelPolicySection rules={rules.modelPolicy ?? {}} onChange={(modelPolicy) => onChange({ ...rules, modelPolicy })} />}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<SecurityPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRules, setEditRules] = useState<PolicyRules>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newRules, setNewRules] = useState<PolicyRules>(DEFAULT_RULES);
  const [newIsActive, setNewIsActive] = useState(false);
  const [activationNotice, setActivationNotice] = useState('');

  const fetchPolicies = useCallback(() => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const headers = { Authorization: `Bearer ${token}` };

    apiFetch<SecurityPolicy[]>(
      `/v1/security/policies/${projectId}`,
      { headers },
    )
      .then((data) => setPolicies(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const handleCreate = async () => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    setFormError('');
    if (!newName.trim()) {
      setFormError('Policy name is required.');
      return;
    }

    setSaving(true);
    setActivationNotice('');
    try {
      const created = await apiFetch<SecurityPolicy>(
        `/v1/security/policies/${projectId}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: newName,
            description: newDescription,
            rules: newRules,
            isActive: newIsActive,
          }),
        },
      );
      setPolicies((prev) => [created, ...prev]);
      setNewName('');
      setNewDescription('');
      setNewRules(DEFAULT_RULES);
      setNewIsActive(false);
      setShowCreateForm(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create policy';
      if (message.includes('currently active')) {
        setActivationNotice(message);
      }
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (policy: SecurityPolicy) => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    setActivationNotice('');

    try {
      const updated = await apiFetch<SecurityPolicy>(
        `/v1/security/policies/${projectId}/${policy.id}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ isActive: !policy.isActive }),
        },
      );
      setPolicies((prev) => prev.map((p) => (p.id === policy.id ? updated : p)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update policy';
      if (message.includes('currently active')) {
        setActivationNotice(message);
      } else {
        setError(message);
      }
    }
  };

  const handleSaveRules = async (policyId: string) => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    setSaving(true);
    setFormError('');
    try {
      const updated = await apiFetch<SecurityPolicy>(
        `/v1/security/policies/${projectId}/${policyId}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ rules: editRules }),
        },
      );
      setPolicies((prev) => prev.map((p) => (p.id === policyId ? updated : p)));
      setEditingId(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update rules');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (policyId: string) => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    try {
      await apiFetch(
        `/v1/security/policies/${projectId}/${policyId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setPolicies((prev) => prev.filter((p) => p.id !== policyId));
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete policy');
    }
  };

  const featureSummary = (rules: PolicyRules) => {
    const features: string[] = [];
    if (rules.pii?.enabled) features.push(`PII (${(rules.pii.types ?? []).length} types)`);
    if (rules.injection?.enabled) features.push(`Injection (${rules.injection.blockThreshold ?? 0.7})`);
    if (rules.jailbreak?.enabled) features.push('Jailbreak');
    if (rules.unicodeSanitizer?.enabled) features.push(`Unicode (${rules.unicodeSanitizer.action ?? 'strip'})`);
    if (rules.secretDetection?.enabled) features.push('Secrets');
    if (rules.topicGuard?.enabled) features.push(`Topics (${(rules.topicGuard.allowedTopics ?? []).length}A/${(rules.topicGuard.blockedTopics ?? []).length}B)`);
    if (rules.contentFilter?.enabled) features.push(`Content (${(rules.contentFilter.categories ?? []).length})`);
    if (rules.outputSafety?.enabled) features.push('Output safety');
    if (rules.promptLeakage?.enabled) features.push('Leakage');
    if ((rules.costGuard?.maxCostPerRequest ?? 0) > 0) features.push('Cost guard');
    if (rules.modelPolicy?.enabled) features.push('Model policy');
    return features.length > 0 ? features.join(' · ') : 'No rules configured';
  };

  if (loading) {
    return <PageLoader message="Loading policies..." />;
  }

  if (error && policies.length === 0) {
    return (
      <div className="flex flex-col items-center py-20">
        <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-center">
          <p className="font-medium text-red-700">Failed to load policies</p>
          <p className="mt-1 text-sm text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Security Policies</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure all 11 guardrails: PII, injection, jailbreak, unicode, secrets, topics, content filter, output safety, prompt leakage, cost guards, and model policy. The active policy is served to your SDK via <code className="rounded bg-gray-100 px-1 text-xs">GET /v1/sdk/policy</code>.
          </p>
        </div>
        <button
          onClick={() => { setShowCreateForm(!showCreateForm); setFormError(''); }}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showCreateForm ? 'Cancel' : 'Create Policy'}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {activationNotice && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">Only one policy can be active at a time</p>
            <p className="mt-1 text-sm text-amber-700">{activationNotice}</p>
          </div>
          <button onClick={() => setActivationNotice('')} className="ml-auto shrink-0 text-amber-400 hover:text-amber-600">&times;</button>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <div className="mt-6 rounded-lg border bg-white p-5">
          <h3 className="text-base font-semibold text-gray-800">New Security Policy</h3>
          {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500">Policy Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Production Security"
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Description</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="What this policy enforces"
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-4">
            <PolicyEditor rules={newRules} onChange={setNewRules} />
          </div>

          <div className="mt-5 flex items-center justify-between border-t pt-4">
            <div>
              <Toggle checked={newIsActive} onChange={setNewIsActive} label={newIsActive ? 'Active — SDK will use this policy' : 'Inactive — activate later'} />
              {newIsActive && policies.some(p => p.isActive) && (
                <p className="mt-1 ml-11 text-xs text-amber-600">Another policy is currently active. Deactivate it first to create this one as active.</p>
              )}
            </div>
            <button
              onClick={handleCreate}
              disabled={saving || !newName.trim()}
              className="flex items-center gap-2 rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving && <Spinner className="h-4 w-4 text-white" />}
              {saving ? 'Creating...' : 'Create Policy'}
            </button>
          </div>
        </div>
      )}

      {/* Policy list */}
      <div className="mt-6 space-y-4">
        {policies.length === 0 && !showCreateForm && (
          <div className="rounded-lg border bg-white p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
              <svg className="h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-700">No security policies yet</h2>
            <p className="mt-2 max-w-md mx-auto text-sm text-gray-500">
              Policies let you manage guardrail rules from the dashboard instead of hardcoding them in the SDK. The SDK fetches the active policy on every request.
            </p>
          </div>
        )}

        {policies.map((policy) => (
          <div key={policy.id} className="rounded-lg border bg-white p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">{policy.name}</h3>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${policy.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {policy.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {policy.description && <p className="mt-0.5 text-sm text-gray-500">{policy.description}</p>}
                <p className="mt-1 text-xs text-gray-400">{featureSummary(policy.rules)}</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Updated {new Date(policy.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(policy)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${policy.isActive ? 'bg-green-600' : 'bg-gray-200'}`}
                  title={policy.isActive ? 'Deactivate policy' : 'Activate policy'}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${policy.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <button
                  onClick={() => {
                    if (editingId === policy.id) {
                      setEditingId(null);
                      setFormError('');
                    } else {
                      setEditingId(policy.id);
                      setEditRules(policy.rules);
                      setFormError('');
                    }
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {editingId === policy.id ? 'Cancel' : 'Edit'}
                </button>
                {deleteConfirmId === policy.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDelete(policy.id)} className="text-sm font-medium text-red-600 hover:text-red-800">Confirm</button>
                    <button onClick={() => setDeleteConfirmId(null)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirmId(policy.id)} className="text-sm text-red-600 hover:text-red-800">Delete</button>
                )}
              </div>
            </div>

            {/* Inline editor */}
            {editingId === policy.id && (
              <div className="mt-4 border-t pt-4">
                {formError && <p className="mb-2 text-sm text-red-600">{formError}</p>}
                <PolicyEditor rules={editRules} onChange={setEditRules} />
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => handleSaveRules(policy.id)}
                    disabled={saving}
                    className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving && <Spinner className="h-4 w-4 text-white" />}
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

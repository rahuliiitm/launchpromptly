'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import { PageLoader } from '@/components/spinner';

// ── Security Overview (Authenticated Dashboard) ──

interface SecurityOverviewData {
  totalEvents: number;
  eventsWithPii: number;
  piiExposureRate: number;
  totalPiiDetections: number;
  injectionAttempts: number;
  injectionBlocked: number;
  redactionRate: number;
  topPiiTypes: { type: string; count: number }[];
  periodDays: number;
}

interface SecurityTimeSeriesPoint {
  date: string;
  piiDetections: number;
  injectionAttempts: number;
  injectionBlocked: number;
  eventsWithRedaction: number;
  totalEvents: number;
}

interface InjectionAnalysis {
  totalAttempts: number;
  blocked: number;
  warned: number;
  allowed: number;
  avgRiskScore: number;
  topTriggered: { category: string; count: number }[];
}

const PERIOD_OPTIONS = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

function Dashboard() {
  const [overview, setOverview] = useState<SecurityOverviewData | null>(null);
  const [timeseries, setTimeseries] = useState<SecurityTimeSeriesPoint[]>([]);
  const [injections, setInjections] = useState<InjectionAnalysis | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      apiFetch<SecurityOverviewData>(
        `/analytics/${projectId}/security/overview?days=${days}`,
        { headers },
      ),
      apiFetch<SecurityTimeSeriesPoint[]>(
        `/analytics/${projectId}/security/timeseries?days=${days}`,
        { headers },
      ),
      apiFetch<InjectionAnalysis>(
        `/analytics/${projectId}/security/injections?days=${days}`,
        { headers },
      ),
    ])
      .then(([ov, ts, inj]) => {
        setOverview(ov);
        setTimeseries(ts);
        setInjections(inj);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return <PageLoader message="Loading security data..." />;
  }

  if (error) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col items-center py-20">
          <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-center">
            <p className="font-medium text-red-700">Failed to load security data</p>
            <p className="mt-1 text-sm text-red-500">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  const piiRateColor =
    overview && overview.piiExposureRate > 10
      ? 'text-red-600'
      : overview && overview.piiExposureRate > 5
        ? 'text-yellow-600'
        : 'text-green-600';

  const redactionRateColor =
    overview && overview.redactionRate > 90 ? 'text-green-600' : 'text-yellow-600';

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Security</h1>
          <p className="mt-1 text-sm text-gray-500">
            PII detection, injection protection, and security analytics
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border bg-white p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                days === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {!overview || overview.totalEvents === 0 ? (
        <div className="mt-8 rounded-lg border bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-700">No security data yet</h2>
          <p className="mt-2 text-sm text-gray-500">
            Security events will appear here once the SDK starts processing requests
            with PII detection and injection protection enabled.
          </p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="mt-6 grid grid-cols-4 gap-4">
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm text-gray-500">PII Exposure Rate</p>
              <p className={`mt-1 text-2xl font-bold ${piiRateColor}`}>
                {overview.piiExposureRate.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {overview.eventsWithPii.toLocaleString()} events with PII
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm text-gray-500">Injection Attempts</p>
              <p className="mt-1 text-2xl font-bold text-red-600">
                {overview.injectionAttempts.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {overview.injectionBlocked.toLocaleString()} blocked
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm text-gray-500">Redaction Rate</p>
              <p className={`mt-1 text-2xl font-bold ${redactionRateColor}`}>
                {overview.redactionRate.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm text-gray-500">Total PII Detections</p>
              <p className="mt-1 text-2xl font-bold">
                {overview.totalPiiDetections.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Security Activity Timeline */}
          {timeseries.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-500">
                Security Activity Timeline
              </h3>
              <div className="mt-3 h-64 rounded-lg border bg-white p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeseries}>
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="piiDetections"
                      name="PII Detections"
                      stroke="#3b82f6"
                      fill="#93c5fd"
                      fillOpacity={0.3}
                    />
                    <Area
                      type="monotone"
                      dataKey="injectionAttempts"
                      name="Injection Attempts"
                      stroke="#ef4444"
                      fill="#fca5a5"
                      fillOpacity={0.3}
                    />
                    <Area
                      type="monotone"
                      dataKey="eventsWithRedaction"
                      name="Redacted Events"
                      stroke="#10b981"
                      fill="#6ee7b7"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* PII Types Breakdown */}
          {overview.topPiiTypes.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-500">
                PII Types Breakdown
              </h3>
              <div className="mt-3 h-64 rounded-lg border bg-white p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={overview.topPiiTypes}
                    layout="vertical"
                    margin={{ left: 80 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="type"
                      tick={{ fontSize: 12 }}
                      width={75}
                    />
                    <Tooltip />
                    <Bar dataKey="count" name="Detections" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Injection Analysis */}
          {injections && injections.totalAttempts > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-500">
                Injection Analysis
              </h3>
              <div className="mt-3 rounded-lg border bg-white p-4">
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Blocked</p>
                    <p className="mt-0.5 text-lg font-bold text-green-600">
                      {injections.blocked.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Warned</p>
                    <p className="mt-0.5 text-lg font-bold text-yellow-600">
                      {injections.warned.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Allowed</p>
                    <p className="mt-0.5 text-lg font-bold text-gray-600">
                      {injections.allowed.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Avg Risk Score</p>
                    <p className="mt-0.5 text-lg font-bold">
                      {injections.avgRiskScore.toFixed(2)}
                    </p>
                  </div>
                </div>
                {injections.topTriggered.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-gray-400">
                      Top Triggered Categories
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {injections.topTriggered.map((t) => (
                        <span
                          key={t.category}
                          className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700"
                        >
                          {t.category}
                          <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-xs">
                            {t.count}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

// ── Marketing Landing Page ──

const FEATURES = [
  {
    title: 'PII Redaction',
    desc: 'Automatically detect and redact emails, phone numbers, SSNs, credit cards, and API keys before they reach your LLM provider. Client-side, zero network exposure.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
      </svg>
    ),
  },
  {
    title: 'Prompt Injection Detection',
    desc: 'Block instruction overrides, role manipulation, delimiter injection, and data exfiltration attempts with rule-based + optional ML detection.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    title: 'Cost Controls',
    desc: 'Set per-request, hourly, daily, and per-customer spend limits. Block runaway LLM costs before they happen with pre-call budget estimation.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Content Filtering',
    desc: 'Detect hate speech, violence, self-harm, and custom policy violations in both LLM inputs and outputs. Configurable warn or block modes.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
      </svg>
    ),
  },
  {
    title: 'Streaming Guard',
    desc: 'Real-time security scanning during LLM streaming. Detect PII and injection attacks mid-stream with rolling window analysis and configurable abort.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    title: 'Audit Trail',
    desc: 'Complete audit log of every guardrail decision — PII redactions, injection blocks, cost overages, and content violations. Searchable and exportable.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
      </svg>
    ),
  },
];

const PRICING = [
  {
    name: 'Indie',
    price: '$29',
    period: '/ month',
    desc: 'For solo developers adding guardrails to LLM apps.',
    features: [
      'PII redaction (16 regex patterns)',
      'Prompt injection detection',
      'Cost guard (per-request & daily budgets)',
      'Guardrail event callbacks',
      '10,000 events / mo',
      'Security dashboard',
      'Community support',
    ],
    cta: 'Start Free Trial',
    highlighted: false,
  },
  {
    name: 'Startup',
    price: '$79',
    period: '/ month',
    desc: 'For teams shipping secure AI to production.',
    features: [
      'Everything in Indie',
      'Streaming guard (mid-stream PII & injection)',
      'Content filtering (11 categories)',
      'Model policy enforcement',
      'Schema validation',
      '100,000 events / mo',
      'Audit log & alerts',
      'Email support',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Growth',
    price: '$199',
    period: '/ month',
    desc: 'For organizations with strict safety requirements.',
    features: [
      'Everything in Startup',
      'ML-enhanced PII (NER: names, orgs, locations)',
      'Semantic injection detection (DeBERTa)',
      'ML toxicity classification (toxic-bert)',
      'Unlimited events',
      'Security policies & RBAC',
      'Priority support & SLA',
    ],
    cta: 'Start Free Trial',
    highlighted: false,
  },
];

function LandingPage() {
  return (
    <div>
      {/* ── Hero ── */}
      <section className="px-6 pb-20 pt-16 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 inline-block rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">
            Layered defense: regex + local ML &mdash; no data leaves your infra
          </div>
          <h1 className="text-5xl font-bold leading-tight tracking-tight text-gray-900">
            Secure your LLM apps
            <br />
            <span className="text-blue-600">in 2 lines of code</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-500">
            LaunchPromptly is a drop-in SDK that adds PII redaction, prompt injection detection,
            cost controls, content filtering, and real-time streaming guard to any LLM application.
            PII is redacted client-side &mdash; before it ever leaves your environment.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/login?redirect=/"
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Start Free &mdash; No Credit Card
            </Link>
            <a
              href="#pricing"
              className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              View Pricing
            </a>
          </div>
        </div>
      </section>

      {/* ── Code Snippet ── */}
      <section className="border-y bg-gray-900 px-6 py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-gray-400">
            Add security in 2 lines
          </h2>
          <div className="mt-6 overflow-hidden rounded-xl border border-gray-700 bg-gray-950">
            <div className="flex items-center gap-2 border-b border-gray-700 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              <span className="h-3 w-3 rounded-full bg-yellow-500" />
              <span className="h-3 w-3 rounded-full bg-green-500" />
              <span className="ml-3 text-xs text-gray-500">app.ts</span>
            </div>
            <pre className="overflow-x-auto p-5 text-sm leading-relaxed">
              <code>
                <span className="text-purple-400">import</span>
                <span className="text-gray-300">{' { LaunchPromptly } '}</span>
                <span className="text-purple-400">from</span>
                <span className="text-green-400">{" 'launchpromptly'"}</span>
                <span className="text-gray-500">;</span>
                {'\n\n'}
                <span className="text-purple-400">const</span>
                <span className="text-blue-300"> lp </span>
                <span className="text-gray-500">= </span>
                <span className="text-purple-400">new</span>
                <span className="text-yellow-300"> LaunchPromptly</span>
                <span className="text-gray-300">{'({ '}</span>
                {'\n'}
                <span className="text-gray-300">{'  '}</span>
                <span className="text-blue-300">apiKey</span>
                <span className="text-gray-500">: </span>
                <span className="text-green-400">process.env.LP_KEY</span>
                <span className="text-gray-500">,</span>
                {'\n'}
                <span className="text-gray-300">{'  '}</span>
                <span className="text-blue-300">security</span>
                <span className="text-gray-500">: </span>
                <span className="text-gray-300">{'{ '}</span>
                {'\n'}
                <span className="text-gray-300">{'    '}</span>
                <span className="text-blue-300">pii</span>
                <span className="text-gray-500">: </span>
                <span className="text-gray-300">{'{ '}</span>
                <span className="text-blue-300">enabled</span>
                <span className="text-gray-500">: </span>
                <span className="text-orange-400">true</span>
                <span className="text-gray-500">, </span>
                <span className="text-blue-300">redaction</span>
                <span className="text-gray-500">: </span>
                <span className="text-green-400">{`'placeholder'`}</span>
                <span className="text-gray-300">{' }'}</span>
                <span className="text-gray-500">,</span>
                {'\n'}
                <span className="text-gray-300">{'    '}</span>
                <span className="text-blue-300">injection</span>
                <span className="text-gray-500">: </span>
                <span className="text-gray-300">{'{ '}</span>
                <span className="text-blue-300">enabled</span>
                <span className="text-gray-500">: </span>
                <span className="text-orange-400">true</span>
                <span className="text-gray-500">, </span>
                <span className="text-blue-300">blockOnHighRisk</span>
                <span className="text-gray-500">: </span>
                <span className="text-orange-400">true</span>
                <span className="text-gray-300">{' }'}</span>
                <span className="text-gray-500">,</span>
                {'\n'}
                <span className="text-gray-300">{'    '}</span>
                <span className="text-blue-300">costGuard</span>
                <span className="text-gray-500">: </span>
                <span className="text-gray-300">{'{ '}</span>
                <span className="text-blue-300">maxCostPerRequest</span>
                <span className="text-gray-500">: </span>
                <span className="text-orange-400">0.50</span>
                <span className="text-gray-300">{' }'}</span>
                <span className="text-gray-500">,</span>
                {'\n'}
                <span className="text-gray-300">{'  }'}</span>
                {'\n'}
                <span className="text-gray-300">{'})'}</span>
                <span className="text-gray-500">;</span>
                {'\n\n'}
                <span className="text-gray-500">{'// Wrap your OpenAI client — security is automatic'}</span>
                {'\n'}
                <span className="text-purple-400">const</span>
                <span className="text-blue-300"> openai </span>
                <span className="text-gray-500">= </span>
                <span className="text-gray-300">lp.</span>
                <span className="text-yellow-300">wrap</span>
                <span className="text-gray-300">(</span>
                <span className="text-purple-400">new</span>
                <span className="text-yellow-300"> OpenAI</span>
                <span className="text-gray-300">()</span>
                <span className="text-gray-300">)</span>
                <span className="text-gray-500">;</span>
                {'\n\n'}
                <span className="text-gray-500">{'// Use as normal — PII is redacted, injections are blocked'}</span>
                {'\n'}
                <span className="text-purple-400">const</span>
                <span className="text-blue-300"> res </span>
                <span className="text-gray-500">= </span>
                <span className="text-purple-400">await</span>
                <span className="text-gray-300"> openai.chat.completions.</span>
                <span className="text-yellow-300">create</span>
                <span className="text-gray-300">({'{ '}</span>
                {'\n'}
                <span className="text-gray-300">{'  '}</span>
                <span className="text-blue-300">model</span>
                <span className="text-gray-500">: </span>
                <span className="text-green-400">{`'gpt-4o'`}</span>
                <span className="text-gray-500">,</span>
                {'\n'}
                <span className="text-gray-300">{'  '}</span>
                <span className="text-blue-300">messages</span>
                <span className="text-gray-500">: </span>
                <span className="text-gray-300">{'[{ '}</span>
                <span className="text-blue-300">role</span>
                <span className="text-gray-500">: </span>
                <span className="text-green-400">{`'user'`}</span>
                <span className="text-gray-500">, </span>
                <span className="text-blue-300">content</span>
                <span className="text-gray-500">: </span>
                <span className="text-gray-300">userInput</span>
                <span className="text-gray-300">{' }]'}</span>
                {'\n'}
                <span className="text-gray-300">{'})'}</span>
                <span className="text-gray-500">;</span>
                {'\n'}
                <span className="text-gray-500">{'// userInput had "email me at john@acme.com"'}</span>
                {'\n'}
                <span className="text-gray-500">{'// LLM received "email me at [EMAIL_1]" — PII never left your server'}</span>
              </code>
            </pre>
          </div>
          <p className="mt-4 text-center text-sm text-gray-400">
            PII is redacted in-process before the API call. The mapping stays in memory &mdash; never sent anywhere.
          </p>
        </div>
      </section>

      {/* ── Why Client-Side ── */}
      <section className="bg-blue-50 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            Why client-side security matters
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <div className="rounded-xl border border-blue-100 bg-white p-5">
              <div className="text-lg font-bold text-blue-600">In-process</div>
              <p className="mt-2 text-sm text-gray-500">
                PII is redacted inside your application before it reaches any network boundary. No proxy, no gateway, no extra hop.
              </p>
            </div>
            <div className="rounded-xl border border-blue-100 bg-white p-5">
              <div className="text-lg font-bold text-blue-600">Zero dependencies</div>
              <p className="mt-2 text-sm text-gray-500">
                Core SDK uses regex-based detection only. No ML models, no external services, no binary dependencies to install.
              </p>
            </div>
            <div className="rounded-xl border border-blue-100 bg-white p-5">
              <div className="text-lg font-bold text-blue-600">Sub-millisecond</div>
              <p className="mt-2 text-sm text-gray-500">
                Regex scanning adds &lt;1ms to each LLM call. No latency penalty, no round-trip to a security gateway.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Layered Defense ── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Layered Defense &mdash; Regex + ML
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-gray-500">
            The only LLM safety SDK that runs ML models locally &mdash; no data leaves your infrastructure.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border-2 border-green-200 bg-green-50 p-6">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white">1</div>
                <h3 className="text-lg font-bold text-green-800">Regex &amp; Rules</h3>
              </div>
              <div className="mt-1 text-xs font-medium uppercase tracking-wide text-green-600">Always on &middot; Zero dependencies</div>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-green-500">&#x2713;</span>
                  16 regex patterns: email, SSN, credit card, phone, IP, etc.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-green-500">&#x2713;</span>
                  5 injection categories: overrides, role hijacking, data exfil
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-green-500">&#x2713;</span>
                  Keyword content filter: hate speech, violence, self-harm
                </li>
              </ul>
              <div className="mt-4 rounded bg-green-100 px-3 py-2 text-xs font-medium text-green-700">
                &lt;1ms latency &middot; No runtime dependencies
              </div>
            </div>
            <div className="rounded-xl border-2 border-purple-200 bg-purple-50 p-6">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-sm font-bold text-white">2</div>
                <h3 className="text-lg font-bold text-purple-800">Local ML Models</h3>
              </div>
              <div className="mt-1 text-xs font-medium uppercase tracking-wide text-purple-600">Opt-in &middot; Runs on your machine</div>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-purple-500">&#x2713;</span>
                  NER-based PII: person names, orgs, locations
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-purple-500">&#x2713;</span>
                  DeBERTa injection: catches obfuscated &amp; encoded attacks
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-purple-500">&#x2713;</span>
                  Toxic-BERT: nuanced hate speech &amp; identity attacks
                </li>
              </ul>
              <div className="mt-4 rounded bg-purple-100 px-3 py-2 text-xs font-medium text-purple-700">
                &lt;100ms latency &middot; No cloud calls &middot; Data stays local
              </div>
            </div>
          </div>
          <p className="mx-auto mt-6 max-w-xl text-center text-sm text-gray-400">
            Both layers run together. ML detections merge with regex results &mdash; giving you the speed of rules
            with the accuracy of ML, without sending data to a third-party API.
          </p>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section className="border-t px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Everything you need to secure LLM applications
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-gray-500">
            From PII redaction to injection defense &mdash; LaunchPromptly covers the full runtime safety lifecycle.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border bg-white p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  {f.icon}
                </div>
                <h3 className="mt-4 font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="border-y bg-gray-50 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Secure in under 5 minutes
          </h2>
          <div className="mt-12 space-y-8">
            {[
              {
                step: '1',
                title: 'Install the SDK',
                desc: 'npm install launchpromptly (or pip install launchpromptly). Zero native dependencies, works everywhere.',
              },
              {
                step: '2',
                title: 'Wrap your LLM client',
                desc: 'Call lp.wrap(openaiClient) with your security options. PII redaction, injection detection, and cost guards activate automatically.',
              },
              {
                step: '3',
                title: 'Ship with confidence',
                desc: 'Every LLM call is protected. Monitor detections in the security dashboard, review audit logs, and adjust policies as needed.',
              },
            ].map((s) => (
              <div key={s.step} className="flex gap-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {s.step}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{s.title}</h3>
                  <p className="mt-1 text-sm text-gray-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Simple, transparent pricing
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-gray-500">
            Start free. Scale security as your LLM usage grows.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {PRICING.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border p-6 ${
                  plan.highlighted
                    ? 'border-blue-600 bg-white shadow-lg ring-1 ring-blue-600'
                    : 'bg-white'
                }`}
              >
                {plan.highlighted && (
                  <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-blue-600">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-sm text-gray-500">{plan.period}</span>
                </div>
                <p className="mt-3 text-sm text-gray-500">{plan.desc}</p>
                <Link
                  href="/login?redirect=/"
                  className={`mt-6 block rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${
                    plan.highlighted
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {plan.cta}
                </Link>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="border-t bg-gray-900 px-6 py-20 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold text-white">
            Stop exposing PII to your LLM provider
          </h2>
          <p className="mt-4 text-gray-400">
            Join developers who protect their users&apos; data with client-side
            PII redaction, injection detection, and cost controls.
          </p>
          <Link
            href="/login?redirect=/"
            className="mt-8 inline-block rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Get Started Free
          </Link>
          <p className="mt-3 text-xs text-gray-500">
            No credit card required &middot; Free tier available forever
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t px-6 py-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between text-xs text-gray-400">
          <span>&copy; {new Date().getFullYear()} LaunchPromptly. All rights reserved.</span>
          <div className="flex gap-6">
            <a href="#pricing" className="hover:text-gray-600">Pricing</a>
            <Link href="/docs" className="hover:text-gray-600">Docs</Link>
            <Link href="/login" className="hover:text-gray-600">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Page Router ──

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  if (isAuthenticated) {
    return <Dashboard />;
  }

  return <LandingPage />;
}

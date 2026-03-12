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
import { OnboardingChecklist } from '@/components/onboarding-checklist';
import { UsageBar } from '@/components/usage-bar';
import { UpgradePrompt } from '@/components/upgrade-prompt';
import { getOnboardingState, isOnboardingComplete, updateOnboarding } from '@/lib/onboarding';
import { generateSecurityReport } from '@/lib/security-report';

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

interface UsageData {
  eventCount: number;
  eventLimit: number;
  percentUsed: number;
  plan: string;
}

function Dashboard() {
  const [overview, setOverview] = useState<SecurityOverviewData | null>(null);
  const [timeseries, setTimeseries] = useState<SecurityTimeSeriesPoint[]>([]);
  const [injections, setInjections] = useState<InjectionAnalysis | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check onboarding state on mount
  useEffect(() => {
    const state = getOnboardingState();
    if (!isOnboardingComplete() && !state.dismissedAt) {
      setShowOnboarding(true);
    }
  }, []);

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
      apiFetch<UsageData>('/billing/usage', { headers }).catch(() => null),
    ])
      .then(([ov, ts, inj, usageData]) => {
        setOverview(ov);
        setTimeseries(ts);
        setInjections(inj);
        if (usageData) setUsage(usageData);
        // Auto-complete onboarding step when events exist
        if (ov && ov.totalEvents > 0) {
          updateOnboarding({ firstCallMade: true });
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [days]);

  if (showOnboarding) {
    return <OnboardingChecklist onComplete={() => setShowOnboarding(false)} />;
  }

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
        <div className="flex items-center gap-3">
          {overview && overview.totalEvents > 0 && (
            <button
              onClick={() => generateSecurityReport({
                projectName: 'My Project',
                periodDays: days,
                totalEvents: overview.totalEvents,
                piiExposureRate: overview.piiExposureRate,
                totalPiiDetections: overview.totalPiiDetections,
                injectionAttempts: overview.injectionAttempts,
                injectionBlocked: overview.injectionBlocked,
                redactionRate: overview.redactionRate,
                topPiiTypes: overview.topPiiTypes,
              })}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export Report
            </button>
          )}
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
      </div>

      {/* Usage bar */}
      {usage && (
        <div className="mt-6 space-y-3">
          <UsageBar eventCount={usage.eventCount} eventLimit={usage.eventLimit} plan={usage.plan} />
          <UpgradePrompt percentUsed={usage.percentUsed} plan={usage.plan} eventLimit={usage.eventLimit} />
        </div>
      )}

      {!overview || overview.totalEvents === 0 ? (
        <div className="mt-8 rounded-lg border bg-white p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-semibold text-gray-700">No security data yet</h2>
          <p className="mt-2 text-sm text-gray-500">
            Security events will appear here once the SDK starts processing requests.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/admin/sdk"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Get Started with the SDK
            </Link>
            <Link
              href="/playground"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Try the Playground
            </Link>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Need help? Check the <Link href="/docs" className="text-blue-600 hover:underline">documentation</Link>.
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
  {
    title: 'Jailbreak Detection',
    desc: 'Catch DAN-mode prompts, persona hijacking, and multi-turn jailbreak attempts. Heuristic scoring with configurable block thresholds for production safety.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
  {
    title: 'Prompt Leakage Detection',
    desc: 'Detect when LLM outputs leak your system prompt, internal instructions, or chain-of-thought reasoning. Scans responses before they reach the user.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    title: 'Unicode Sanitizer',
    desc: 'Strip zero-width characters, homoglyph attacks, invisible separators, and bidirectional text overrides that bypass naive text filters.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
      </svg>
    ),
  },
  {
    title: 'Secret Detection',
    desc: 'Find AWS keys, JWTs, GitHub tokens, private keys, and database connection strings in prompts before they get sent to your LLM provider.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
  },
  {
    title: 'Topic Guard',
    desc: 'Define allowed and blocked topics for your LLM. Prevent off-topic conversations, competitor mentions, or out-of-scope requests with keyword and pattern matching.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
      </svg>
    ),
  },
  {
    title: 'Output Safety Scanning',
    desc: 'Scan LLM responses for harmful content, hallucinated PII, code injection, and policy violations before they reach your users. Defense-in-depth for outputs.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
];

const PRICING = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    desc: 'Try LaunchPromptly with no commitment.',
    features: [
      'PII redaction (16 regex patterns)',
      'Prompt injection detection',
      'Cost guard',
      'Unicode sanitizer',
      'Secret detection',
      '1,000 events / mo',
      'Security dashboard',
    ],
    cta: 'Start Free Beta',
    highlighted: false,
  },
  {
    name: 'Indie',
    price: '$29',
    period: '/ month',
    desc: 'For solo developers adding guardrails to LLM apps.',
    features: [
      'Everything in Free',
      'Guardrail event callbacks',
      '10,000 events / mo',
      'Community support',
    ],
    cta: 'Start Free Beta',
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
      'Jailbreak detection',
      'Topic guard (allowed/blocked topics)',
      'Output safety scanning',
      'Content filtering (11 categories)',
      'Model policy enforcement',
      'Schema validation',
      '100,000 events / mo',
      'Audit log & alerts',
      'Email support',
    ],
    cta: 'Start Free Beta',
    highlighted: true,
  },
  {
    name: 'Growth',
    price: '$199',
    period: '/ month',
    desc: 'For organizations with strict safety requirements.',
    features: [
      'Everything in Startup',
      'Prompt leakage detection',
      'ML-enhanced PII (NER: names, orgs, locations)',
      'Semantic injection detection (DeBERTa)',
      'ML toxicity classification (toxic-bert)',
      'ML providers for all guardrails',
      'Unlimited events',
      'Security policies & RBAC',
      'Priority support & SLA',
    ],
    cta: 'Start Free Beta',
    highlighted: false,
  },
];

function LandingPage() {
  return (
    <div>
      {/* ── Hero ── */}
      <section className="px-6 pb-20 pt-16 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 inline-block rounded-full border border-green-200 bg-green-50 px-4 py-1.5 text-sm font-medium text-green-700">
            Public Beta &mdash; all features free until April 30
          </div>
          <h1 className="text-5xl font-bold leading-tight tracking-tight text-gray-900">
            Ship enterprise-ready AI apps.
            <br />
            <span className="text-blue-600">Security compliance built in.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-500">
            Drop-in SDK + compliance dashboard for teams building on LLMs.
            PII redaction, injection detection, cost controls, and audit trail &mdash;
            everything runs client-side, your data never leaves your infrastructure.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/login?redirect=/"
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Start Free Beta
            </Link>
            <Link
              href="/playground"
              className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Try the Playground &rarr;
            </Link>
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
                <span className="text-gray-300">{'    '}</span>
                <span className="text-blue-300">jailbreak</span>
                <span className="text-gray-500">: </span>
                <span className="text-gray-300">{'{ '}</span>
                <span className="text-blue-300">enabled</span>
                <span className="text-gray-500">: </span>
                <span className="text-orange-400">true</span>
                <span className="text-gray-300">{' }'}</span>
                <span className="text-gray-500">,</span>
                {'\n'}
                <span className="text-gray-300">{'    '}</span>
                <span className="text-blue-300">unicodeSanitizer</span>
                <span className="text-gray-500">: </span>
                <span className="text-gray-300">{'{ '}</span>
                <span className="text-blue-300">enabled</span>
                <span className="text-gray-500">: </span>
                <span className="text-orange-400">true</span>
                <span className="text-gray-300">{' }'}</span>
                <span className="text-gray-500">,</span>
                {'\n'}
                <span className="text-gray-300">{'    '}</span>
                <span className="text-blue-300">secretDetection</span>
                <span className="text-gray-500">: </span>
                <span className="text-gray-300">{'{ '}</span>
                <span className="text-blue-300">enabled</span>
                <span className="text-gray-500">: </span>
                <span className="text-orange-400">true</span>
                <span className="text-gray-300">{' }'}</span>
                <span className="text-gray-500">,</span>
                {'\n'}
                <span className="text-gray-300">{'    '}</span>
                <span className="text-blue-300">topicGuard</span>
                <span className="text-gray-500">: </span>
                <span className="text-gray-300">{'{ '}</span>
                <span className="text-blue-300">blockedTopics</span>
                <span className="text-gray-500">: </span>
                <span className="text-gray-300">{'['}</span>
                <span className="text-green-400">{`'competitors'`}</span>
                <span className="text-gray-300">{'] }'}</span>
                <span className="text-gray-500">,</span>
                {'\n'}
                <span className="text-gray-300">{'    '}</span>
                <span className="text-blue-300">outputSafety</span>
                <span className="text-gray-500">: </span>
                <span className="text-gray-300">{'{ '}</span>
                <span className="text-blue-300">enabled</span>
                <span className="text-gray-500">: </span>
                <span className="text-orange-400">true</span>
                <span className="text-gray-300">{' }'}</span>
                <span className="text-gray-500">,</span>
                {'\n'}
                <span className="text-gray-300">{'    '}</span>
                <span className="text-blue-300">promptLeakage</span>
                <span className="text-gray-500">: </span>
                <span className="text-gray-300">{'{ '}</span>
                <span className="text-blue-300">enabled</span>
                <span className="text-gray-500">: </span>
                <span className="text-orange-400">true</span>
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

      {/* ── Trusted By (Design Partner Placeholder) ── */}
      <section className="border-t bg-gray-50 px-6 py-12">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Trusted by teams building enterprise AI
          </p>
          <div className="mt-6 flex items-center justify-center gap-12">
            <div className="h-8 w-24 rounded bg-gray-200" />
            <div className="h-8 w-24 rounded bg-gray-200" />
            <div className="h-8 w-24 rounded bg-gray-200" />
            <div className="h-8 w-24 rounded bg-gray-200" />
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Launching with design partners &mdash; <Link href="/login?redirect=/" className="text-blue-600 hover:underline">join the beta</Link>
          </p>
        </div>
      </section>

      {/* ── 4 Key Features ── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Runtime security + compliance dashboard
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-gray-500">
            12 guardrails that run client-side, plus the audit trail your customers&apos; security teams need.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border bg-white p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">PII Redaction</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">Client-side detection and redaction of emails, SSNs, credit cards, and 13 more patterns. Data never leaves your infra.</p>
            </div>
            <div className="rounded-xl border bg-white p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">Injection Detection</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">Block prompt injection, jailbreaks, and role manipulation with rule-based + optional local ML detection.</p>
            </div>
            <div className="rounded-xl border bg-white p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">CostGuard</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">Per-customer sliding window spend limits with pre-call budget estimation. Stop runaway LLM costs before they happen.</p>
            </div>
            <div className="rounded-xl border bg-white p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">Compliance Dashboard</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">Audit trail, security reports, and analytics your customers&apos; security teams can review during procurement.</p>
            </div>
          </div>
          <p className="mt-8 text-center text-sm text-gray-500">
            Plus 8 more guardrails: streaming guard, content filtering, jailbreak detection, unicode sanitizer, secret detection, topic guard, output safety, and prompt leakage.{' '}
            <Link href="/why" className="text-blue-600 hover:underline">See all guardrails and how we compare &rarr;</Link>
          </p>
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
                desc: 'Every LLM call is protected. Export security reports for your customers, review audit logs, and prove compliance to enterprise buyers.',
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
            All tiers free during beta. Billing starts May 1.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
            Your customers&apos; security teams will thank you
          </h2>
          <p className="mt-4 text-gray-400">
            12 guardrails, audit trail, and security reports &mdash; everything an enterprise buyer needs to approve your AI product.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/login?redirect=/"
              className="rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Start Free Beta
            </Link>
            <Link
              href="/security"
              className="text-sm font-medium text-gray-400 hover:text-white"
            >
              Read our security practices &rarr;
            </Link>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            No credit card required &middot; All features free during beta
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t px-6 py-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between text-xs text-gray-400">
          <span>&copy; {new Date().getFullYear()} LaunchPromptly. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/why" className="hover:text-gray-600">Why LaunchPromptly</Link>
            <Link href="/security" className="hover:text-gray-600">Security</Link>
            <a href="#pricing" className="hover:text-gray-600">Pricing</a>
            <Link href="/playground" className="hover:text-gray-600">Playground</Link>
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

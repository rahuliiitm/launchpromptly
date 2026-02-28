'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, useIsAdmin } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';

// ── Authenticated Dashboard ──

interface ChecklistState {
  apiKey: boolean;
  sdkInstalled: boolean;
  securityPolicy: boolean;
}

interface SecurityStats {
  piiDetections: number;
  injectionAttempts: number;
  eventsProtected: number;
}

function Dashboard() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const [checklist, setChecklist] = useState<ChecklistState>({
    apiKey: false,
    sdkInstalled: false,
    securityPolicy: false,
  });
  const [securityStats, setSecurityStats] = useState<SecurityStats | null>(null);
  const [loadingChecklist, setLoadingChecklist] = useState(true);

  useEffect(() => {
    if (!user?.projectId) return;

    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    const headers = { Authorization: `Bearer ${token}` };

    Promise.allSettled([
      apiFetch<{ id: string }[]>(`/project/${projectId}/api-keys`, { headers }),
      apiFetch<unknown>(`/analytics/${projectId}/overview?days=30`, { headers }),
      apiFetch<unknown[]>(`/v1/security/policies/${projectId}`, { headers }),
      apiFetch<{ piiDetections?: number; injectionAttempts?: number; totalEvents?: number }>(`/analytics/${projectId}/security/overview?days=30`, { headers }),
    ]).then(([apiKeyRes, eventsRes, policyRes, securityRes]) => {
      const apiKeys = apiKeyRes.status === 'fulfilled' ? apiKeyRes.value : [];
      const hasEvents = eventsRes.status === 'fulfilled';
      const policies = policyRes.status === 'fulfilled' ? policyRes.value : [];

      setChecklist({
        apiKey: apiKeys.length > 0,
        sdkInstalled: hasEvents,
        securityPolicy: policies.length > 0,
      });

      if (securityRes.status === 'fulfilled') {
        const data = securityRes.value;
        setSecurityStats({
          piiDetections: data.piiDetections ?? 0,
          injectionAttempts: data.injectionAttempts ?? 0,
          eventsProtected: data.totalEvents ?? 0,
        });
      }

      setLoadingChecklist(false);
    });
  }, [user?.projectId]);

  const allComplete = !isAdmin || (checklist.apiKey && checklist.sdkInstalled && checklist.securityPolicy);

  const steps = [
    {
      key: 'apiKey',
      title: 'Generate an SDK API key',
      description: 'Create an API key to connect the LaunchPromptly SDK to your project.',
      href: '/admin/api-keys',
      linkText: 'Go to API Keys',
      done: checklist.apiKey,
    },
    {
      key: 'sdkInstalled',
      title: 'Install the SDK & enable security',
      description: 'Add lp.wrap(openaiClient) to get automatic PII redaction, injection detection, and cost controls.',
      href: '/admin/sdk',
      linkText: 'View SDK Setup Guide',
      done: checklist.sdkInstalled,
    },
    {
      key: 'securityPolicy',
      title: 'Configure a security policy',
      description: 'Set PII redaction rules, injection thresholds, and cost limits for your project.',
      href: '/admin/security/policies',
      linkText: 'Create Security Policy',
      done: checklist.securityPolicy,
    },
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">
        Welcome{user?.email ? `, ${user.email.split('@')[0]}` : ''}
      </h1>

      {loadingChecklist ? (
        <div className="mt-8 text-gray-400">Loading setup status...</div>
      ) : allComplete ? (
        <div className="mt-8">
          <p className="text-gray-600">Your security setup is active. Here&apos;s a quick overview.</p>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <Link
              href="/admin/security"
              className="rounded-lg border bg-white p-5 transition hover:border-blue-300"
            >
              <div className="text-2xl font-bold">
                {securityStats ? securityStats.eventsProtected.toLocaleString() : <span className="text-gray-400">&mdash;</span>}
              </div>
              <div className="mt-1 text-sm text-gray-500">Events Protected (30d)</div>
            </Link>
            <div className="rounded-lg border bg-white p-5">
              <div className="text-2xl font-bold text-orange-600">
                {securityStats ? securityStats.piiDetections.toLocaleString() : <span className="text-gray-400">&mdash;</span>}
              </div>
              <div className="mt-1 text-sm text-gray-500">PII Detections (30d)</div>
            </div>
            <div className="rounded-lg border bg-white p-5">
              <div className="text-2xl font-bold text-red-600">
                {securityStats ? securityStats.injectionAttempts.toLocaleString() : <span className="text-gray-400">&mdash;</span>}
              </div>
              <div className="mt-1 text-sm text-gray-500">Injection Attempts Blocked</div>
            </div>
            <Link
              href="/admin/security/audit"
              className="rounded-lg border bg-white p-5 transition hover:border-blue-300"
            >
              <div className="text-2xl font-bold text-gray-400">&mdash;</div>
              <div className="mt-1 text-sm text-gray-500">Audit Log & Compliance</div>
            </Link>
          </div>

          <div className="mt-6 flex gap-3">
            <Link
              href="/admin/security"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Security Dashboard
            </Link>
            <Link
              href="/admin/security/policies"
              className="rounded border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Manage Policies
            </Link>
            <Link
              href="/prompts"
              className="rounded border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Prompt Playground
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <p className="text-gray-600">
            Complete these steps to start protecting your LLM application.
          </p>

          <div className="mt-6 space-y-3">
            {steps.map((step, i) => (
              <div
                key={step.key}
                className={`rounded-lg border p-4 ${
                  step.done ? 'border-green-200 bg-green-50' : 'bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      step.done
                        ? 'bg-green-600 text-white'
                        : 'border-2 border-gray-300 text-gray-400'
                    }`}
                  >
                    {step.done ? (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <div className="flex-1">
                    <div className={`font-medium ${step.done ? 'text-green-800' : 'text-gray-900'}`}>
                      {step.title}
                    </div>
                    <div className={`mt-0.5 text-sm ${step.done ? 'text-green-600' : 'text-gray-500'}`}>
                      {step.description}
                    </div>
                    {!step.done && (
                      <Link
                        href={step.href}
                        className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        {step.linkText} &rarr;
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
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
    desc: 'Set per-request, per-minute, and per-customer spend limits. Block runaway LLM costs before they happen with pre-call budget estimation.',
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
    title: 'Compliance & Audit',
    desc: 'GDPR/CCPA/HIPAA-ready with consent tracking, data retention policies, geofencing, and a complete audit trail of every security decision.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
      </svg>
    ),
  },
  {
    title: 'Prompt Management',
    desc: 'Version, deploy, and A/B test your prompts without redeploying. Built-in playground for multi-model testing and LLM-as-Judge evaluations.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
];

const PRICING = [
  {
    name: 'Starter',
    price: '$0',
    period: 'forever',
    desc: 'For developers adding security to their LLM apps.',
    features: [
      'PII redaction (regex, 9 patterns)',
      'Prompt injection detection',
      'Cost guard (per-request limits)',
      '1,000 events / mo',
      '3 managed prompts',
      'Community support',
    ],
    cta: 'Get Started Free',
    highlighted: false,
  },
  {
    name: 'Growth',
    price: '$49',
    period: '/ month',
    desc: 'For teams shipping secure AI to production.',
    features: [
      'Everything in Starter',
      'Content filtering',
      'Compliance tooling (GDPR/CCPA)',
      '100,000 events / mo',
      '25 managed prompts',
      'Audit log & security dashboard',
      'Email support',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: '$199',
    period: '/ month',
    desc: 'For organizations with strict compliance requirements.',
    features: [
      'Everything in Growth',
      'ML-enhanced PII (names, orgs, addresses)',
      'Semantic injection detection',
      'Unlimited events',
      'Unlimited prompts',
      'Security policies & RBAC',
      'Encrypted storage at rest',
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
            Client-side LLM security &mdash; zero dependencies
          </div>
          <h1 className="text-5xl font-bold leading-tight tracking-tight text-gray-900">
            Secure your LLM apps
            <br />
            <span className="text-blue-600">in 2 lines of code</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-500">
            LaunchPromptly is a drop-in SDK that adds PII redaction, prompt injection detection,
            cost controls, and compliance tooling to any LLM application.
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

      {/* ── Features Grid ── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Everything you need to secure LLM applications
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-gray-500">
            From PII protection to compliance tooling &mdash; LaunchPromptly covers the full security lifecycle.
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
            <Link href="/pricing" className="hover:text-gray-600">Pricing</Link>
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
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  if (isAuthenticated) {
    return <Dashboard />;
  }

  return <LandingPage />;
}

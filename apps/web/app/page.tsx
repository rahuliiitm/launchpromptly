'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useIsAdmin } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';

// ── Authenticated Dashboard ──

interface ChecklistState {
  providerKey: boolean;
  prompt: boolean;
  apiKey: boolean;
}

interface DashboardStats {
  activePrompts: number;
  totalApiKeys: number;
}

function Dashboard() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const [checklist, setChecklist] = useState<ChecklistState>({
    providerKey: false,
    prompt: false,
    apiKey: false,
  });
  const [stats, setStats] = useState<DashboardStats>({ activePrompts: 0, totalApiKeys: 0 });
  const [loadingChecklist, setLoadingChecklist] = useState(true);

  useEffect(() => {
    if (!user?.projectId) return;

    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    const headers = { Authorization: `Bearer ${token}` };

    Promise.allSettled([
      apiFetch<{ id: string }[]>('/provider-keys', { headers }),
      apiFetch<{ id: string; slug: string }[]>(`/prompt/${projectId}`, { headers }),
      apiFetch<{ id: string }[]>(`/project/${projectId}/api-keys`, { headers }),
    ]).then(([providerRes, promptRes, apiKeyRes]) => {
      const hasProviderKey = providerRes.status === 'fulfilled' && providerRes.value.length > 0;
      const prompts = promptRes.status === 'fulfilled' ? promptRes.value : [];
      const apiKeys = apiKeyRes.status === 'fulfilled' ? apiKeyRes.value : [];

      setChecklist({
        providerKey: hasProviderKey,
        prompt: prompts.length > 0,
        apiKey: apiKeys.length > 0,
      });
      setStats({
        activePrompts: prompts.length,
        totalApiKeys: apiKeys.length,
      });
      setLoadingChecklist(false);
    });
  }, [user?.projectId]);

  const allComplete = !isAdmin || (checklist.providerKey && checklist.prompt && checklist.apiKey);

  const steps = [
    {
      key: 'providerKey',
      title: 'Add an LLM provider key',
      description: 'Connect your OpenAI or Anthropic API key so you can test prompts.',
      href: '/admin/providers',
      linkText: 'Go to LLM Providers',
      done: checklist.providerKey,
    },
    {
      key: 'prompt',
      title: 'Test a prompt in the Playground',
      description: 'Write a system prompt, test it against models, and publish as a managed prompt.',
      href: '/prompts',
      linkText: 'Open Playground',
      done: checklist.prompt,
    },
    {
      key: 'apiKey',
      title: 'Generate an SDK API key',
      description: 'Create an API key to integrate PlanForge into your application.',
      href: '/admin/api-keys',
      linkText: 'Go to API Keys',
      done: checklist.apiKey,
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
          <p className="text-gray-600">Your setup is complete. Here&apos;s a quick overview.</p>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <Link
              href="/prompts/managed"
              className="rounded-lg border bg-white p-5 transition hover:border-blue-300"
            >
              <div className="text-2xl font-bold">{stats.activePrompts}</div>
              <div className="mt-1 text-sm text-gray-500">Managed Prompts</div>
            </Link>
            <Link
              href="/observability"
              className="rounded-lg border bg-white p-5 transition hover:border-blue-300"
            >
              <div className="text-2xl font-bold text-gray-400">&mdash;</div>
              <div className="mt-1 text-sm text-gray-500">Observability</div>
            </Link>
          </div>

          <div className="mt-6 flex gap-3">
            <Link
              href="/prompts"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Open Playground
            </Link>
            <Link
              href="/prompts/managed"
              className="rounded border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Manage Prompts
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <p className="text-gray-600">
            Complete these steps to start managing your AI prompts.
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
    title: 'Cost Tracking',
    desc: 'See exactly what every LLM call costs. Break down spend by customer, feature, model, and prompt.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'RAG Quality Evaluation',
    desc: 'Auto-evaluate faithfulness, answer relevance, and context relevance with LLM-as-judge scoring.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
      </svg>
    ),
  },
  {
    title: 'Prompt Management',
    desc: 'Version, deploy, and A/B test prompts without redeploying your app. Roll back in one click.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    title: 'Pipeline Tracing',
    desc: 'Group multi-step LLM calls into flows. See rerank, generate, and guardrail steps in a single timeline.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
      </svg>
    ),
  },
  {
    title: 'Per-Customer Analytics',
    desc: 'Know which customers are driving your LLM costs. Attribute spend to features and user segments.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    title: '2-Line Integration',
    desc: 'Wrap your OpenAI client and you are done. No proxy, no config files, no infrastructure changes.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
  },
];

const PRICING = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    desc: 'For developers getting started with LLM observability.',
    features: [
      '5,000 events / month',
      '1 project',
      'Cost & latency tracking',
      'Analytics dashboard',
      'Prompt playground',
      'Community support',
    ],
    cta: 'Get Started Free',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/ month',
    desc: 'For developers and small teams shipping to production.',
    features: [
      '50,000 events / month',
      'Unlimited projects',
      'RAG quality evaluation',
      'Prompt versioning & A/B tests',
      'Pipeline flow tracing',
      'Per-customer cost attribution',
      'Email support',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Team',
    price: '$49',
    period: '/ month',
    desc: 'For production teams that need scale and collaboration.',
    features: [
      '500,000 events / month',
      'Everything in Pro',
      'Team management & roles',
      'Member invitations with RBAC',
      'Priority support & SLA',
      'Dedicated onboarding',
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
            Open-source LLM observability
          </div>
          <h1 className="text-5xl font-bold leading-tight tracking-tight text-gray-900">
            Stop guessing what your
            <br />
            <span className="text-blue-600">LLM calls</span> actually cost
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-500">
            PlanForge gives you full visibility into your LLM spending, RAG quality, and prompt
            performance. Drop in our SDK, see everything in real time.
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
            Integrate in 2 minutes
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
                <span className="text-gray-300">{' { PlanForge } '}</span>
                <span className="text-purple-400">from</span>
                <span className="text-green-400">{" '@planforge/node'"}</span>
                <span className="text-gray-500">;</span>
                {'\n\n'}
                <span className="text-purple-400">const</span>
                <span className="text-blue-300"> pf </span>
                <span className="text-gray-500">= </span>
                <span className="text-purple-400">new</span>
                <span className="text-yellow-300"> PlanForge</span>
                <span className="text-gray-300">{'({ '}</span>
                <span className="text-blue-300">apiKey</span>
                <span className="text-gray-500">: </span>
                <span className="text-green-400">process.env.PLANFORGE_KEY</span>
                <span className="text-gray-300">{' })'}</span>
                <span className="text-gray-500">;</span>
                {'\n\n'}
                <span className="text-gray-500">{'// Wrap your OpenAI client — that\'s it'}</span>
                {'\n'}
                <span className="text-purple-400">const</span>
                <span className="text-blue-300"> client </span>
                <span className="text-gray-500">= </span>
                <span className="text-gray-300">pf.</span>
                <span className="text-yellow-300">wrap</span>
                <span className="text-gray-300">(openai, {'{ '}</span>
                {'\n'}
                <span className="text-gray-300">{'  '}</span>
                <span className="text-blue-300">feature</span>
                <span className="text-gray-500">: </span>
                <span className="text-green-400">{`'knowledge-base'`}</span>
                <span className="text-gray-500">,</span>
                {'\n'}
                <span className="text-gray-300">{'  '}</span>
                <span className="text-blue-300">traceId</span>
                <span className="text-gray-500">: </span>
                <span className="text-gray-300">req.id</span>
                <span className="text-gray-500">,</span>
                {'\n'}
                <span className="text-gray-300">{'  '}</span>
                <span className="text-blue-300">spanName</span>
                <span className="text-gray-500">: </span>
                <span className="text-green-400">{`'generate'`}</span>
                {'\n'}
                <span className="text-gray-300">{'})'}</span>
                <span className="text-gray-500">;</span>
                {'\n\n'}
                <span className="text-gray-500">{'// Use it exactly like the normal OpenAI client'}</span>
                {'\n'}
                <span className="text-purple-400">const</span>
                <span className="text-blue-300"> response </span>
                <span className="text-gray-500">= </span>
                <span className="text-purple-400">await</span>
                <span className="text-gray-300"> client.chat.completions.</span>
                <span className="text-yellow-300">create</span>
                <span className="text-gray-300">({'{ ... }'})</span>
                <span className="text-gray-500">;</span>
              </code>
            </pre>
          </div>
          <p className="mt-4 text-center text-sm text-gray-400">
            Every call is automatically tracked &mdash; cost, latency, tokens, and quality.
          </p>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Everything you need to ship LLMs with confidence
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-gray-500">
            From cost tracking to quality evaluation, PlanForge covers the full lifecycle of your LLM features.
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
            Up and running in 5 minutes
          </h2>
          <div className="mt-12 space-y-8">
            {[
              {
                step: '1',
                title: 'Install the SDK',
                desc: 'npm install @planforge/node — works with any Node.js app.',
              },
              {
                step: '2',
                title: 'Wrap your LLM client',
                desc: 'One line to wrap your OpenAI client. Every call is automatically captured.',
              },
              {
                step: '3',
                title: 'See everything in your dashboard',
                desc: 'Costs, latency, token usage, RAG quality scores — all in real time.',
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
            Start free. Upgrade when you need more events, team features, or evaluations.
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
            Stop flying blind with your LLM costs
          </h2>
          <p className="mt-4 text-gray-400">
            Join developers who are shipping LLM features with full visibility
            into cost, quality, and performance.
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
          <span>&copy; {new Date().getFullYear()} PlanForge. All rights reserved.</span>
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

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';

const PLANS = [
  {
    name: 'Free',
    key: 'free',
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
    limits: [
      'No RAG evaluations',
      'No prompt A/B testing',
    ],
    cta: 'Get Started Free',
    highlighted: false,
  },
  {
    name: 'Pro',
    key: 'pro',
    price: '$19',
    period: '/ month',
    desc: 'For developers and small teams shipping to production.',
    features: [
      '50,000 events / month',
      'Unlimited projects',
      'RAG quality evaluation (LLM-as-judge)',
      'Prompt versioning & A/B tests',
      'Pipeline flow tracing',
      'Per-customer cost attribution',
      'Prompt playground with model comparison',
      'Email support',
    ],
    limits: [],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Team',
    key: 'team',
    price: '$49',
    period: '/ month',
    desc: 'For production teams that need scale and collaboration.',
    features: [
      '500,000 events / month',
      'Everything in Pro',
      'Team management & roles',
      'Member invitations with RBAC',
      'Priority support & SLA',
      'Dedicated onboarding call',
    ],
    limits: [],
    cta: 'Start Free Trial',
    highlighted: false,
  },
];

const FAQ = [
  {
    q: 'What counts as an event?',
    a: 'Every LLM API call captured by the SDK counts as one event. A multi-step RAG pipeline with 3 LLM calls counts as 3 events.',
  },
  {
    q: 'Can I upgrade or downgrade at any time?',
    a: 'Yes. Changes take effect immediately. When upgrading, you get prorated access to your new plan. When downgrading, you keep access until the end of your billing cycle.',
  },
  {
    q: 'Do you store my LLM prompts and responses?',
    a: 'We store metadata (tokens, cost, latency) by default. Prompt content storage is opt-in and can be disabled per project.',
  },
  {
    q: 'What happens if I exceed my event limit?',
    a: 'We will never drop your data. Events beyond your plan limit are queued and you will be notified. You can upgrade anytime to increase your limit.',
  },
  {
    q: 'Do you support providers other than OpenAI?',
    a: 'The SDK currently wraps OpenAI-compatible clients. Anthropic, Cohere, and other providers are on the roadmap. The ingestion API accepts events from any provider.',
  },
];

interface BillingInfo {
  plan: string;
  checkoutUrls: { pro: string; team: string };
}

export default function PricingPage() {
  const { isAuthenticated, user } = useAuth();
  const [billing, setBilling] = useState<BillingInfo | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = getToken();
    if (!token) return;
    apiFetch<BillingInfo>('/billing/info', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(setBilling)
      .catch(() => {});
  }, [isAuthenticated]);

  const currentPlan = billing?.plan ?? user?.plan ?? 'free';

  function getCtaHref(planKey: string): string {
    if (planKey === 'free') return isAuthenticated ? '/' : '/login?redirect=/';
    if (!isAuthenticated) return `/login?redirect=/pricing`;
    const url = billing?.checkoutUrls?.[planKey as 'pro' | 'team'];
    return url || '/admin';
  }

  function getCtaLabel(planKey: string, defaultCta: string): string {
    if (planKey === 'free' && currentPlan === 'free') return 'Current Plan';
    if (planKey === 'pro' && currentPlan === 'pro') return 'Current Plan';
    if (planKey === 'team' && (currentPlan === 'business' || currentPlan === 'team')) return 'Current Plan';
    return defaultCta;
  }

  function isCurrentPlan(planKey: string): boolean {
    if (planKey === 'free' && currentPlan === 'free') return true;
    if (planKey === 'pro' && currentPlan === 'pro') return true;
    if (planKey === 'team' && (currentPlan === 'business' || currentPlan === 'team')) return true;
    return false;
  }

  return (
    <div>
      <section className="px-6 pb-16 pt-12">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-center text-4xl font-bold text-gray-900">Pricing</h1>
          <p className="mx-auto mt-3 max-w-xl text-center text-gray-500">
            Start free. Upgrade when your LLM usage grows.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {PLANS.map((plan) => {
              const isCurrent = isCurrentPlan(plan.key);
              return (
                <div
                  key={plan.name}
                  className={`flex flex-col rounded-xl border p-6 ${
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
                  <h2 className="text-lg font-bold text-gray-900">{plan.name}</h2>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-sm text-gray-500">{plan.period}</span>
                  </div>
                  <p className="mt-3 text-sm text-gray-500">{plan.desc}</p>

                  {isCurrent ? (
                    <div className="mt-6 block rounded-lg border-2 border-green-500 px-4 py-2.5 text-center text-sm font-semibold text-green-700">
                      Current Plan
                    </div>
                  ) : (
                    <Link
                      href={getCtaHref(plan.key)}
                      className={`mt-6 block rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${
                        plan.highlighted
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {getCtaLabel(plan.key, plan.cta)}
                    </Link>
                  )}

                  <ul className="mt-6 flex-1 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                        <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        {f}
                      </li>
                    ))}
                    {plan.limits.map((l) => (
                      <li key={l} className="flex items-start gap-2 text-sm text-gray-400">
                        <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        {l}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            Frequently Asked Questions
          </h2>
          <div className="mt-10 space-y-6">
            {FAQ.map((item) => (
              <div key={item.q}>
                <h3 className="font-semibold text-gray-900">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Ready to get started?</h2>
        <p className="mt-2 text-gray-500">Free tier is free forever. No credit card required.</p>
        <Link
          href={isAuthenticated ? '/' : '/login?redirect=/'}
          className="mt-6 inline-block rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {isAuthenticated ? 'Go to Dashboard' : 'Create Your Account'}
        </Link>
      </section>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';

const PLANS = [
  {
    name: 'Starter',
    key: 'free',
    price: '$0',
    period: 'forever',
    desc: 'For developers exploring prompt management.',
    features: [
      '3 managed prompts',
      '1,000 API fetches / mo',
      '2 environments',
      'Prompt playground',
      '50 eval runs / mo included',
      'Community support',
    ],
    limits: [
      'No A/B testing',
      'No eval gates',
    ],
    cta: 'Get Started Free',
    highlighted: false,
  },
  {
    name: 'Growth',
    key: 'pro',
    price: '$29',
    period: '/ month',
    desc: 'For teams shipping AI features to production.',
    features: [
      '25 managed prompts',
      '50,000 API fetches / mo',
      'Unlimited environments',
      'A/B testing & eval gates',
      'Auto-generated eval datasets',
      '500 eval runs / mo included',
      'Prompt playground with model comparison',
      'Email support',
    ],
    limits: [],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Scale',
    key: 'team',
    price: '$99',
    period: '/ month',
    desc: 'For organizations that need collaboration and governance.',
    features: [
      'Unlimited prompts',
      '500,000 API fetches / mo',
      'Everything in Growth',
      'Team management & RBAC',
      'Eval gate enforcement',
      '2,000 eval runs / mo included',
      'Priority support & SLA',
      'Dedicated onboarding',
    ],
    limits: [],
    cta: 'Start Free Trial',
    highlighted: false,
  },
];

const OBSERVABILITY_TIERS = [
  {
    name: 'Free',
    price: 'Included',
    desc: '1,000 events / mo',
    features: ['Cost & latency tracking', 'Basic analytics dashboard'],
  },
  {
    name: 'Pro',
    price: '+$19 / mo',
    desc: '100,000 events / mo',
    features: ['Everything in Free', 'Per-customer attribution', 'Pipeline tracing'],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    desc: 'Unlimited events',
    features: ['Everything in Pro', 'Custom dashboards', 'Data export & API'],
  },
];

const FAQ = [
  {
    q: 'What counts as a managed prompt?',
    a: 'Each unique prompt you create and deploy counts as one managed prompt. Different versions of the same prompt count as one prompt.',
  },
  {
    q: 'What counts as an API fetch?',
    a: 'Every time your application calls pf.getPrompt() to retrieve a prompt via the SDK, that counts as one API fetch. Cached responses on your side don\u2019t count.',
  },
  {
    q: 'What are included eval runs?',
    a: 'Each plan includes LLM credits for running evaluations in the playground and eval system. You don\u2019t need your own API key to test prompts \u2014 we cover the cost. Need more? Bring your own key for unlimited runs.',
  },
  {
    q: 'Can I upgrade or downgrade at any time?',
    a: 'Yes. Changes take effect immediately. When upgrading, you get prorated access to your new plan. When downgrading, you keep access until the end of your billing cycle.',
  },
  {
    q: 'How does the SDK fetch prompts?',
    a: 'Your app calls pf.getPrompt(\'slug\', { environment }) at runtime. LaunchPromptly returns the active deployed version. Update prompts from the dashboard \u2014 no code changes needed.',
  },
  {
    q: 'Is observability required?',
    a: 'No. Observability is a separate add-on. You can use LaunchPromptly purely for prompt management without tracking LLM calls. Add observability only when you need call-level analytics.',
  },
  {
    q: 'What LLM providers are supported?',
    a: 'LaunchPromptly manages your prompts, not your LLM calls. Use the fetched prompt text with any provider \u2014 OpenAI, Anthropic, Cohere, or any other.',
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
      {/* ── Prompt Management Pricing ── */}
      <section className="px-6 pb-16 pt-12">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-center text-4xl font-bold text-gray-900">Pricing</h1>
          <p className="mx-auto mt-3 max-w-xl text-center text-gray-500">
            Pay only for what you use. Scale up as your prompts go to production.
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

          <p className="mt-6 text-center text-sm text-gray-400">
            Need more? <span className="font-medium text-gray-600">Enterprise</span> plans with unlimited
            everything, SSO, and dedicated support are available.{' '}
            <a href="mailto:hello@launchpromptly.dev" className="text-blue-600 hover:underline">Contact us</a>
          </p>
        </div>
      </section>

      {/* ── Observability Add-on ── */}
      <section className="border-t bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            Observability Add-on
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm text-gray-500">
            Track every LLM call &mdash; cost, latency, tokens. Add it independently to any prompt management plan.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {OBSERVABILITY_TIERS.map((tier) => (
              <div key={tier.name} className="rounded-xl border bg-white p-5">
                <h3 className="font-semibold text-gray-900">{tier.name}</h3>
                <div className="mt-1 text-lg font-bold text-gray-900">{tier.price}</div>
                <p className="mt-1 text-xs text-gray-500">{tier.desc}</p>
                <ul className="mt-4 space-y-2">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                      <svg className="mt-0.5 h-3 w-3 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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

      {/* ── FAQ ── */}
      <section className="border-t px-6 py-16">
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

      {/* ── CTA ── */}
      <section className="border-t bg-gray-50 px-6 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Ready to get started?</h2>
        <p className="mt-2 text-gray-500">Starter plan is free forever. No credit card required.</p>
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

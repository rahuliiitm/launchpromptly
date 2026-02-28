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
    desc: 'For developers adding security to their first LLM app.',
    features: [
      'PII redaction (9 regex patterns)',
      'Prompt injection detection (5 rule categories)',
      'Cost guard (per-request limits)',
      '1,000 secured events / mo',
      '3 managed prompts',
      'Prompt playground',
      'Community support',
    ],
    limits: [
      'No content filtering',
      'No compliance tooling',
    ],
    cta: 'Get Started Free',
    highlighted: false,
  },
  {
    name: 'Growth',
    key: 'pro',
    price: '$49',
    period: '/ month',
    desc: 'For teams shipping secure AI to production.',
    features: [
      'Everything in Starter',
      'Content filtering (hate speech, violence, custom)',
      'Compliance tooling (GDPR/CCPA consent, retention)',
      '100,000 secured events / mo',
      '25 managed prompts',
      'Security dashboard & audit log',
      'A/B testing & eval gates',
      'Email support',
    ],
    limits: [],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    key: 'team',
    price: '$199',
    period: '/ month',
    desc: 'For organizations with strict compliance and governance needs.',
    features: [
      'Everything in Growth',
      'ML-enhanced PII detection (names, orgs, addresses)',
      'Semantic injection detection (ML classifier)',
      'ML toxicity scoring',
      'Unlimited secured events',
      'Unlimited managed prompts',
      'Security policies & RBAC',
      'AES-256-GCM encrypted storage at rest',
      'Geofencing & data residency',
      'Priority support & SLA',
    ],
    limits: [],
    cta: 'Start Free Trial',
    highlighted: false,
  },
];

const ML_PLUGIN_FEATURES = [
  {
    name: 'NER-based PII',
    desc: 'Detect person names, organization names, and free-form addresses using Presidio + spaCy NER models.',
  },
  {
    name: 'Semantic Injection Detection',
    desc: 'Catch rephrased and indirect injection attacks with a small DeBERTa classifier (5MB ONNX model).',
  },
  {
    name: 'ML Toxicity Scoring',
    desc: 'Nuanced toxicity detection using toxic-bert for content that evades keyword-based filters.',
  },
];

const FAQ = [
  {
    q: 'How does client-side PII redaction work?',
    a: 'The SDK scans your LLM request messages in-process (inside your application) before they leave your environment. PII like emails, phone numbers, and SSNs are replaced with placeholders like [EMAIL_1]. The LLM never sees the real data. After the response, the SDK can optionally de-redact the output using an in-memory mapping that is never sent anywhere.',
  },
  {
    q: 'What PII types does the regex engine detect?',
    a: 'The core SDK detects 9 PII types: emails, US/international phone numbers, SSNs, credit cards (with Luhn validation), IPv4 addresses, API keys/secrets (OpenAI, AWS, GitHub), dates of birth, and US street addresses. The optional ML plugin adds person names, organization names, and free-form addresses.',
  },
  {
    q: 'What counts as a "secured event"?',
    a: 'Each LLM API call that passes through the SDK\'s security pipeline counts as one secured event. This includes the full pre-call scan (PII, injection, cost, content, compliance) and post-call scan (response PII, response content).',
  },
  {
    q: 'Do I need the ML plugin?',
    a: 'No. The core SDK is zero-dependency and catches ~70% of PII with regex patterns. The ML plugin (launchpromptly-ml for Node, launchpromptly[ml] for Python) adds NER-based detection for person names, org names, and free-form addresses, plus semantic injection detection. It\'s optional and available on Enterprise plans.',
  },
  {
    q: 'What happens if PII detection errors?',
    a: 'The SDK is fail-open by default — if detection errors, the LLM call proceeds normally with a warning in the event metadata. You can configure fail-closed behavior with blockOnHighRisk: true for any security module.',
  },
  {
    q: 'Does the SDK add latency?',
    a: 'The core regex-based scanning adds <1ms per LLM call. The ML plugin adds ~50-200ms depending on text length and model. Both are significantly faster than gateway-based solutions that require a network round-trip.',
  },
  {
    q: 'Can I still use prompt management features?',
    a: 'Yes. LaunchPromptly includes full prompt versioning, deployment, A/B testing, LLM-as-Judge evaluations, and a playground. Security and prompt management work together — your managed prompts are automatically protected by the security pipeline.',
  },
  {
    q: 'What LLM providers are supported?',
    a: 'The SDK wraps any OpenAI-compatible client. This includes OpenAI, Azure OpenAI, Anthropic (via OpenAI compatibility), and any provider that follows the OpenAI chat completions API format.',
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
      {/* ── Main Pricing ── */}
      <section className="px-6 pb-16 pt-12">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-center text-4xl font-bold text-gray-900">Pricing</h1>
          <p className="mx-auto mt-3 max-w-xl text-center text-gray-500">
            Start free with core security. Scale up as your LLM applications grow.
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
            Need a custom plan? <span className="font-medium text-gray-600">Custom Enterprise</span> with
            dedicated infrastructure, SSO, and on-premise deployment available.{' '}
            <a href="mailto:hello@launchpromptly.dev" className="text-blue-600 hover:underline">Contact us</a>
          </p>
        </div>
      </section>

      {/* ── ML Plugin ── */}
      <section className="border-t bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            Optional ML Plugin
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm text-gray-500">
            Enhanced detection with machine learning. Install separately &mdash; keeps core SDK lightweight.
          </p>

          <div className="mt-8 flex items-center justify-center gap-4">
            <code className="rounded bg-gray-900 px-4 py-2 text-sm text-green-400">
              npm install launchpromptly-ml
            </code>
            <span className="text-sm text-gray-400">or</span>
            <code className="rounded bg-gray-900 px-4 py-2 text-sm text-green-400">
              pip install launchpromptly[ml]
            </code>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {ML_PLUGIN_FEATURES.map((feat) => (
              <div key={feat.name} className="rounded-xl border bg-white p-5">
                <h3 className="font-semibold text-gray-900">{feat.name}</h3>
                <p className="mt-2 text-sm text-gray-500">{feat.desc}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            ML plugin included with Enterprise plan. Available as an add-on for Growth plan at $29/mo.
          </p>
        </div>
      </section>

      {/* ── Comparison Table ── */}
      <section className="border-t px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold text-gray-900">
            Security Feature Comparison
          </h2>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-3 pr-4 font-semibold text-gray-900">Feature</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-900">Starter</th>
                  <th className="px-4 py-3 text-center font-semibold text-blue-600">Growth</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-900">Enterprise</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                {[
                  ['PII Redaction (regex)', true, true, true],
                  ['PII Redaction (ML/NER)', false, false, true],
                  ['Prompt Injection (rules)', true, true, true],
                  ['Prompt Injection (ML)', false, false, true],
                  ['Cost Guard', true, true, true],
                  ['Content Filtering', false, true, true],
                  ['Toxicity Detection (ML)', false, false, true],
                  ['GDPR/CCPA Compliance', false, true, true],
                  ['Audit Log', false, true, true],
                  ['Security Dashboard', false, true, true],
                  ['Security Policies', false, false, true],
                  ['Encrypted Storage', false, false, true],
                  ['Geofencing', false, false, true],
                  ['Managed Prompts', '3', '25', 'Unlimited'],
                  ['Secured Events / mo', '1,000', '100,000', 'Unlimited'],
                ].map((row) => (
                  <tr key={row[0] as string} className="border-b">
                    <td className="py-3 pr-4">{row[0]}</td>
                    {[row[1], row[2], row[3]].map((val, i) => (
                      <td key={i} className="px-4 py-3 text-center">
                        {val === true ? (
                          <svg className="mx-auto h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        ) : val === false ? (
                          <svg className="mx-auto h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        ) : (
                          <span className="font-medium">{val}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
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

      {/* ── CTA ── */}
      <section className="border-t px-6 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Ready to secure your LLM application?</h2>
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

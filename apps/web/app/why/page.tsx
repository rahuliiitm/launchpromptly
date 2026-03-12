'use client';

import Link from 'next/link';

const COMPARISON = [
  { feature: 'CostGuard (per-customer spend limits)', lp: true, llmGuard: false, lakera: false, guardrailsAi: false },
  { feature: 'Unicode attack detection', lp: true, llmGuard: 'partial', lakera: 'unknown', guardrailsAi: false },
  { feature: 'Stream scanning (mid-flight)', lp: true, llmGuard: false, lakera: true, guardrailsAi: false },
  { feature: 'Prompt leakage detection', lp: true, llmGuard: false, lakera: true, guardrailsAi: false },
  { feature: 'In-SDK ML (no cloud calls)', lp: true, llmGuard: true, lakera: false, guardrailsAi: true },
  { feature: 'De-redaction (restore PII post-LLM)', lp: true, llmGuard: 'partial', lakera: 'unknown', guardrailsAi: false },
  { feature: 'Output schema validation', lp: true, llmGuard: false, lakera: false, guardrailsAi: true },
  { feature: 'Client-side (no API proxy)', lp: true, llmGuard: true, lakera: false, guardrailsAi: false },
  { feature: 'Compliance dashboard + audit trail', lp: true, llmGuard: false, lakera: false, guardrailsAi: false },
  { feature: 'Secret detection (AWS keys, JWTs)', lp: true, llmGuard: false, lakera: false, guardrailsAi: false },
];

function CellValue({ value }: { value: boolean | string }) {
  if (value === true) return <span className="text-green-600 font-semibold">Yes</span>;
  if (value === false) return <span className="text-gray-300">No</span>;
  if (value === 'partial') return <span className="text-yellow-600">Partial</span>;
  return <span className="text-gray-400">Unknown</span>;
}

export default function WhyPage() {
  return (
    <div>
      {/* Hero */}
      <section className="px-6 pb-16 pt-16 text-center">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-gray-900">
            The only LLM security SDK that also protects your
            <span className="text-blue-600"> infrastructure costs </span>
            and validates your
            <span className="text-blue-600"> outputs</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-500">
            Most guardrail tools scan inputs. LaunchPromptly secures the full lifecycle &mdash;
            inputs, outputs, costs, and compliance &mdash; all client-side.
          </p>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold text-gray-900">Feature comparison</h2>
          <p className="mt-2 text-sm text-gray-500">How LaunchPromptly stacks up against the most common alternatives.</p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 pr-4 font-medium text-gray-500">Feature</th>
                  <th className="pb-3 px-4 font-semibold text-blue-700 bg-blue-50 rounded-t-lg">LaunchPromptly</th>
                  <th className="pb-3 px-4 font-medium text-gray-500">LLM Guard</th>
                  <th className="pb-3 px-4 font-medium text-gray-500">Lakera Guard</th>
                  <th className="pb-3 px-4 font-medium text-gray-500">Guardrails AI</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.feature} className="border-b last:border-0">
                    <td className="py-3 pr-4 text-gray-700">{row.feature}</td>
                    <td className="py-3 px-4 bg-blue-50"><CellValue value={row.lp} /></td>
                    <td className="py-3 px-4"><CellValue value={row.llmGuard} /></td>
                    <td className="py-3 px-4"><CellValue value={row.lakera} /></td>
                    <td className="py-3 px-4"><CellValue value={row.guardrailsAi} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Differentiator Deep-Dives */}
      <section className="border-t bg-gray-50 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-gray-900">What makes us different</h2>

          {/* CostGuard */}
          <div className="mt-10 rounded-xl border bg-white p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900">CostGuard</h3>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Unique to LaunchPromptly</span>
            </div>
            <p className="mt-4 text-gray-600">
              Per-customer sliding window spend limits with pre-call budget estimation.
              Set hourly, daily, and monthly caps per customer. The SDK estimates token cost
              <em> before</em> the LLM call and blocks requests that would exceed the budget.
            </p>
            <div className="mt-4 rounded-lg bg-gray-900 p-4 text-sm">
              <pre className="text-gray-300 overflow-x-auto"><code>{`costGuard: {
  maxCostPerRequest: 0.50,
  dailyLimit: 10.00,
  monthlyLimit: 100.00,
  perCustomer: true  // Track per customerId
}`}</code></pre>
            </div>
            <p className="mt-3 text-sm text-gray-500">No other guardrail SDK offers per-customer spend tracking. LLM Guard, Lakera, and Guardrails AI have no cost protection.</p>
          </div>

          {/* Unicode Sanitizer */}
          <div className="mt-6 rounded-xl border bg-white p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900">Unicode Sanitizer</h3>
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">Runs before all other guardrails</span>
            </div>
            <p className="mt-4 text-gray-600">
              Zero-width characters, homoglyph attacks, invisible separators, and bidirectional text overrides
              can bypass naive text filters. LaunchPromptly strips these <em>before</em> other guardrails run,
              so downstream PII detection and injection scanning see clean text.
            </p>
            <p className="mt-3 text-sm text-gray-500">Most competitors miss this entirely. An attacker using zero-width characters between &quot;S&quot; and &quot;S&quot; and &quot;N&quot; can bypass regex-based SSN detection in tools without unicode sanitization.</p>
          </div>

          {/* Compliance Dashboard */}
          <div className="mt-6 rounded-xl border bg-white p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900">Compliance Dashboard</h3>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Your customers will love this</span>
            </div>
            <p className="mt-4 text-gray-600">
              Every guardrail decision is logged with timestamps, severity, and customer context.
              Export security reports that your customers&apos; security teams can review during procurement.
              PII exposure rates, injection attempt counts, redaction stats &mdash; all in one dashboard.
            </p>
            <p className="mt-3 text-sm text-gray-500">LLM Guard is open-source with no dashboard. Lakera has monitoring but no exportable compliance reports. Guardrails AI focuses on detection, not audit trails.</p>
          </div>
        </div>
      </section>

      {/* Performance */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-gray-900">Performance</h2>
          <p className="mt-2 text-gray-500">Client-side means zero network latency. Your guardrails run as fast as a regex.</p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border p-6 text-center">
              <div className="text-3xl font-bold text-green-600">&lt;5ms</div>
              <div className="mt-2 text-sm font-medium text-gray-700">Regex pipeline</div>
              <div className="mt-1 text-xs text-gray-500">PII + injection + content filter</div>
            </div>
            <div className="rounded-xl border p-6 text-center">
              <div className="text-3xl font-bold text-purple-600">+30-100ms</div>
              <div className="mt-2 text-sm font-medium text-gray-700">ML plugin (opt-in)</div>
              <div className="mt-1 text-xs text-gray-500">Local ONNX models, no cloud</div>
            </div>
            <div className="rounded-xl border p-6 text-center">
              <div className="text-3xl font-bold text-blue-600">&lt;1ms</div>
              <div className="mt-2 text-sm font-medium text-gray-700">CostGuard</div>
              <div className="mt-1 text-xs text-gray-500">Budget check overhead</div>
            </div>
            <div className="rounded-xl border p-6 text-center">
              <div className="text-3xl font-bold text-gray-900">0ms</div>
              <div className="mt-2 text-sm font-medium text-gray-700">Network overhead</div>
              <div className="mt-1 text-xs text-gray-500">Client-side, no API round-trip</div>
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-gray-500">
            Lakera Guard advertises &lt;50ms &mdash; that includes their cloud API round-trip.
            Our regex pipeline runs in &lt;5ms with zero network calls.
          </p>
        </div>
      </section>

      {/* Layered Defense (moved from landing page) */}
      <section className="border-t bg-gray-50 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-gray-900">Layered defense: regex + local ML</h2>
          <p className="mt-2 text-gray-500">The only LLM safety SDK that runs ML models locally &mdash; no data leaves your infrastructure.</p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border-2 border-green-200 bg-white p-6">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white">1</div>
                <h3 className="text-lg font-bold text-green-800">Regex &amp; Rules</h3>
              </div>
              <div className="mt-1 text-xs font-medium uppercase tracking-wide text-green-600">Always on &middot; Zero dependencies</div>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2"><span className="mt-0.5 text-green-500">&#x2713;</span>16 PII patterns: email, SSN, credit card, phone, IP</li>
                <li className="flex items-start gap-2"><span className="mt-0.5 text-green-500">&#x2713;</span>5 injection categories: overrides, role hijacking, data exfil</li>
                <li className="flex items-start gap-2"><span className="mt-0.5 text-green-500">&#x2713;</span>Jailbreak, prompt leakage, unicode sanitizer</li>
                <li className="flex items-start gap-2"><span className="mt-0.5 text-green-500">&#x2713;</span>Secret detection, topic guard, content filter</li>
              </ul>
              <div className="mt-4 rounded bg-green-100 px-3 py-2 text-xs font-medium text-green-700">&lt;5ms latency &middot; No dependencies</div>
            </div>
            <div className="rounded-xl border-2 border-purple-200 bg-white p-6">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-sm font-bold text-white">2</div>
                <h3 className="text-lg font-bold text-purple-800">Local ML Models</h3>
              </div>
              <div className="mt-1 text-xs font-medium uppercase tracking-wide text-purple-600">Opt-in &middot; Runs on your machine</div>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2"><span className="mt-0.5 text-purple-500">&#x2713;</span>NER-based PII: person names, orgs, locations</li>
                <li className="flex items-start gap-2"><span className="mt-0.5 text-purple-500">&#x2713;</span>DeBERTa injection: obfuscated &amp; encoded attacks</li>
                <li className="flex items-start gap-2"><span className="mt-0.5 text-purple-500">&#x2713;</span>Toxic-BERT: nuanced hate speech detection</li>
              </ul>
              <div className="mt-4 rounded bg-purple-100 px-3 py-2 text-xs font-medium text-purple-700">&lt;100ms latency &middot; No cloud calls</div>
            </div>
          </div>
        </div>
      </section>

      {/* All 12 Guardrails */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-gray-900">All 12 guardrails</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: 'PII Redaction', desc: '16 regex patterns + optional NER' },
              { name: 'Prompt Injection', desc: 'Rule-based + DeBERTa ML' },
              { name: 'CostGuard', desc: 'Per-customer spend limits' },
              { name: 'Content Filtering', desc: '11 categories, warn or block' },
              { name: 'Streaming Guard', desc: 'Mid-stream PII & injection scanning' },
              { name: 'Jailbreak Detection', desc: 'DAN-mode, persona hijacking' },
              { name: 'Prompt Leakage', desc: 'System prompt leak detection' },
              { name: 'Unicode Sanitizer', desc: 'Zero-width, homoglyphs, bidi' },
              { name: 'Secret Detection', desc: 'AWS keys, JWTs, GitHub tokens' },
              { name: 'Topic Guard', desc: 'Allowed/blocked topic enforcement' },
              { name: 'Output Safety', desc: 'Harmful content, code injection' },
              { name: 'Schema Validation', desc: 'Enforce JSON output structure' },
            ].map((g) => (
              <div key={g.name} className="flex items-start gap-3 rounded-lg border bg-white p-4">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <div className="font-medium text-gray-900">{g.name}</div>
                  <div className="text-xs text-gray-500">{g.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-gray-900 px-6 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold text-white">Ready to see it in action?</h2>
          <p className="mt-4 text-gray-400">Try the playground or start the beta &mdash; all features free until April 30.</p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/login?redirect=/"
              className="rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Start Free Beta
            </Link>
            <Link
              href="/playground"
              className="rounded-lg border border-gray-600 px-8 py-3 text-sm font-semibold text-gray-300 hover:bg-gray-800"
            >
              Try the Playground
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

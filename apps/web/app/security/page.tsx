'use client';

import Link from 'next/link';

const COLLECTED = [
  'Token count (input & output)',
  'Model name (e.g. gpt-4o)',
  'Estimated cost per request',
  'Latency (ms)',
  'Guardrail trigger types & counts',
  'Injection risk score',
  'Redaction applied (boolean)',
  'Timestamps',
  'Customer ID (if provided)',
];

const NOT_COLLECTED = [
  'Prompt text (by default)',
  'Response text (by default)',
  'PII values (emails, SSNs, etc.)',
  'Raw user content',
  'API keys or secrets',
  'File uploads or attachments',
  'IP addresses of end users',
];

export default function SecurityPage() {
  return (
    <div>
      {/* Hero */}
      <section className="px-6 pb-12 pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Security &amp; Privacy</h1>
          <p className="mt-4 text-lg text-gray-500">
            How LaunchPromptly protects your data. Built for teams that need to pass security reviews.
          </p>
        </div>
      </section>

      {/* Data Flow */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-gray-900">How your data flows</h2>
          <p className="mt-2 text-gray-500">Guardrails run inside your application. No API proxy. No data routing through our servers.</p>

          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:gap-0">
            {/* Step 1 */}
            <div className="flex-1 rounded-xl border-2 border-blue-200 bg-blue-50 p-5 text-center">
              <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">Your Application</div>
              <div className="mt-2 text-sm text-gray-700">User sends a prompt</div>
            </div>
            <div className="hidden sm:block">
              <svg className="h-6 w-12 text-gray-400" fill="none" viewBox="0 0 48 24" stroke="currentColor" strokeWidth={2}>
                <path d="M0 12h40m-8-8l8 8-8 8" />
              </svg>
            </div>
            {/* Step 2 */}
            <div className="flex-1 rounded-xl border-2 border-green-200 bg-green-50 p-5 text-center">
              <div className="text-xs font-semibold uppercase tracking-wider text-green-600">LaunchPromptly SDK</div>
              <div className="mt-2 text-sm text-gray-700">
                PII redacted, injection checked, cost estimated
                <div className="mt-1 text-xs text-green-600 font-medium">Runs in-process &mdash; no network call</div>
              </div>
            </div>
            <div className="hidden sm:block">
              <svg className="h-6 w-12 text-gray-400" fill="none" viewBox="0 0 48 24" stroke="currentColor" strokeWidth={2}>
                <path d="M0 12h40m-8-8l8 8-8 8" />
              </svg>
            </div>
            {/* Step 3 */}
            <div className="flex-1 rounded-xl border-2 border-gray-200 bg-gray-50 p-5 text-center">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">Your LLM Provider</div>
              <div className="mt-2 text-sm text-gray-700">Receives clean, redacted prompt</div>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-3 text-center">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">LaunchPromptly Dashboard</div>
              <div className="mt-1 text-xs text-gray-500">Receives metadata only: token counts, costs, guardrail trigger types</div>
              <div className="mt-1 text-xs text-gray-400">No prompt text, no PII values, no user content</div>
            </div>
          </div>
        </div>
      </section>

      {/* What We See vs Don't */}
      <section className="border-t bg-gray-50 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-gray-900">What we see vs. what we don&apos;t</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border bg-white p-6">
              <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                What we receive
              </h3>
              <ul className="mt-4 space-y-2">
                {COLLECTED.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border bg-white p-6">
              <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
                What we NEVER receive
              </h3>
              <ul className="mt-4 space-y-2">
                {NOT_COLLECTED.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
                <strong>Optional:</strong> <code className="text-xs">promptPreview</code> and <code className="text-xs">responseText</code> can be
                enabled for debugging. When enabled, they are encrypted with AES-256-GCM at rest.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Architecture */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-gray-900">Security architecture</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border p-6">
              <h3 className="font-semibold text-gray-900">Client-side processing</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                <li><strong>In-process:</strong> PII is redacted inside your app before it reaches any network boundary</li>
                <li><strong>Zero dependencies:</strong> Core SDK uses regex only &mdash; no ML models, no external services</li>
                <li><strong>Sub-millisecond:</strong> Regex scanning adds &lt;1ms per LLM call</li>
              </ul>
            </div>
            <div className="rounded-xl border p-6">
              <h3 className="font-semibold text-gray-900">Encryption</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                <li><strong>At rest:</strong> AES-256-GCM for any stored sensitive fields (prompt previews, response text)</li>
                <li><strong>In transit:</strong> HTTPS/TLS for all API communication</li>
                <li><strong>API keys:</strong> bcrypt-hashed, only prefix stored in plaintext</li>
              </ul>
            </div>
            <div className="rounded-xl border p-6">
              <h3 className="font-semibold text-gray-900">Zero telemetry</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                <li>SDK makes <strong>no calls</strong> to LaunchPromptly analytics or tracking</li>
                <li>Events go to <strong>your configured endpoint</strong> only</li>
                <li>No phone-home, no usage beacons, no third-party analytics</li>
              </ul>
            </div>
            <div className="rounded-xl border p-6">
              <h3 className="font-semibold text-gray-900">Local ML models</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                <li>Optional ML models (NER, DeBERTa, Toxic-BERT) run <strong>on your machine</strong></li>
                <li>ONNX runtime &mdash; no cloud ML API calls</li>
                <li>Data never leaves your infrastructure, even with ML enabled</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Compliance Posture */}
      <section className="border-t bg-gray-50 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-gray-900">Compliance posture</h2>
          <p className="mt-2 text-gray-500">Features that help you meet regulatory requirements.</p>
          <div className="mt-8 space-y-4">
            {[
              {
                title: 'Data retention',
                desc: 'Configurable per project (default 90 days). Auto-enforced by scheduled cleanup.',
                status: 'Available',
              },
              {
                title: 'Audit logging',
                desc: 'Every guardrail decision logged with timestamps, severity, and customer context. Searchable and filterable.',
                status: 'Available',
              },
              {
                title: 'Data deletion API',
                desc: 'Delete events by customer ID or age. Supports HIPAA right-to-deletion and GDPR erasure requirements.',
                status: 'Coming soon',
              },
              {
                title: 'Data export API',
                desc: 'Export all data for a given customer. Supports GDPR data portability requirements.',
                status: 'Coming soon',
              },
              {
                title: 'Security report export',
                desc: 'Generate PDF security reports from the dashboard for procurement reviews.',
                status: 'Coming soon',
              },
            ].map((item) => (
              <div key={item.title} className="flex items-start justify-between rounded-lg border bg-white p-5">
                <div>
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-gray-500">{item.desc}</p>
                </div>
                <span className={`ml-4 shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                  item.status === 'Available'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold text-gray-900">Questions about our security practices?</h2>
          <p className="mt-3 text-gray-500">We&apos;re happy to walk through our architecture with your security team.</p>
          <div className="mt-6 flex items-center justify-center gap-4">
            <Link
              href="/login?redirect=/"
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Start Free Beta
            </Link>
            <Link
              href="/docs"
              className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Read the SDK Docs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

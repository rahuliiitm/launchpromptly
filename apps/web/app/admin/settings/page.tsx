'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import { PageLoader } from '@/components/spinner';
import { UsageBar } from '@/components/usage-bar';
import { updateOnboarding } from '@/lib/onboarding';
import type { ApiKey, Environment } from '@launchpromptly/types';

interface BillingInfo {
  plan: string;
  subscriptionStatus?: string;
  planExpiresAt?: string;
  hasSubscription: boolean;
  portalUrl?: string;
  checkoutUrls: { pro: string; team: string };
}

interface UsageData {
  eventCount: number;
  eventLimit: number;
  percentUsed: number;
  plan: string;
}

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    limit: '1,000 events/mo',
    features: ['PII redaction', 'Injection detection', 'Cost guard', 'Security dashboard'],
  },
  {
    key: 'pro',
    name: 'Indie',
    price: '$29',
    limit: '10,000 events/mo',
    checkout: 'pro' as const,
    features: ['Everything in Free', 'Guardrail event callbacks', 'Community support'],
  },
  {
    key: 'business',
    name: 'Startup',
    price: '$79',
    limit: '100,000 events/mo',
    checkout: 'team' as const,
    features: ['Everything in Indie', 'Streaming guard', 'Content filtering', 'Audit log & alerts'],
  },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [newKey, setNewKey] = useState('');
  const [selectedEnvId, setSelectedEnvId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) {
      setLoading(false);
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      apiFetch<BillingInfo>('/billing/info', { headers }).catch(() => null),
      apiFetch<UsageData>('/billing/usage', { headers }).catch(() => null),
      apiFetch<ApiKey[]>(`/project/${projectId}/api-keys`, { headers }).catch(() => []),
      apiFetch<Environment[]>(`/environment/${projectId}`, { headers }).catch(() => []),
    ])
      .then(([b, u, k, envs]) => {
        if (b) setBilling(b);
        if (u) setUsage(u);
        setKeys(k || []);
        const envList = envs || [];
        setEnvironments(envList);
        if (envList.length > 0) setSelectedEnvId(envList[0]!.id);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleGenerate = async () => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;
    try {
      const result = await apiFetch<{ apiKey: ApiKey; rawKey: string }>(
        `/project/${projectId}/api-keys`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: 'Generated Key',
            ...(selectedEnvId && { environmentId: selectedEnvId }),
          }),
        },
      );
      setNewKey(result.rawKey);
      setKeys((prev) => [result.apiKey, ...prev]);
      updateOnboarding({ apiKeyGenerated: true });
    } catch {
      // Silently fail
    }
  };

  const handleRevoke = async (keyId: string) => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;
    await apiFetch(`/project/${projectId}/api-keys/${keyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setKeys((prev) => prev.filter((k) => k.id !== keyId));
  };

  if (loading) return <PageLoader message="Loading settings..." />;

  const currentPlan = billing?.plan || user?.plan || 'free';
  const envNameById = new Map(environments.map((e) => [e.id, e.name]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your plan, API keys, and account.</p>
      </div>

      {/* Plan & Billing */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900">Plan & Billing</h2>
        <div className="mt-4 space-y-4">
          {usage && (
            <UsageBar eventCount={usage.eventCount} eventLimit={usage.eventLimit} plan={usage.plan} />
          )}

          {billing?.hasSubscription && billing.portalUrl && (
            <a
              href={billing.portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Manage Subscription
            </a>
          )}

          {/* Plan cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {PLANS.map((plan) => {
              const isCurrent = plan.key === currentPlan;
              const checkoutUrl = plan.checkout && billing?.checkoutUrls
                ? billing.checkoutUrls[plan.checkout]
                : null;

              return (
                <div
                  key={plan.key}
                  className={`rounded-lg border p-5 ${
                    isCurrent ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                    {isCurrent && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-2xl font-bold">{plan.price}<span className="text-sm font-normal text-gray-500">/mo</span></p>
                  <p className="mt-1 text-sm text-gray-500">{plan.limit}</p>
                  <ul className="mt-3 space-y-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                        <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {!isCurrent && checkoutUrl && (
                    <a
                      href={checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 block rounded bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Upgrade to {plan.name}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* API Keys */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
        <p className="mt-1 text-sm text-gray-500">Keys authenticate the LaunchPromptly SDK with your project.</p>

        <div className="mt-4 flex items-center gap-3">
          {environments.length > 0 && (
            <select
              value={selectedEnvId}
              onChange={(e) => setSelectedEnvId(e.target.value)}
              className="rounded border px-3 py-2 text-sm"
            >
              {environments.map((env) => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={handleGenerate}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Generate New Key
          </button>
        </div>

        {newKey && (
          <div className="mt-4 rounded border border-yellow-300 bg-yellow-50 p-4">
            <p className="text-sm font-medium text-yellow-800">
              Copy this key now — it won&apos;t be shown again:
            </p>
            <code className="mt-2 block break-all rounded bg-gray-100 p-2 text-xs font-mono">
              {newKey}
            </code>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between rounded border bg-white p-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{key.keyPrefix}...</span>
                <span className="text-sm text-gray-500">{key.name}</span>
                {key.environmentId && (
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {envNameById.get(key.environmentId) ?? 'Unknown env'}
                  </span>
                )}
              </div>
              <button
                onClick={() => handleRevoke(key.id)}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Revoke
              </button>
            </div>
          ))}
          {keys.length === 0 && (
            <p className="text-sm text-gray-400">No API keys yet. Generate one above to get started.</p>
          )}
        </div>
      </section>

      {/* Account */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900">Account</h2>
        <div className="mt-4 rounded-lg border bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-gray-500">Email</p>
              <p className="mt-1 text-sm text-gray-900">{user?.email || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Role</p>
              <p className="mt-1">
                <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                  user?.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {user?.role === 'admin' ? 'Admin' : 'Member'}
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

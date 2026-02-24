'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import { useAuth, useIsAdmin } from '@/lib/auth-context';
import type { ApiKey } from '@aiecon/types';

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) {
      setLoading(false);
      return;
    }
    apiFetch<ApiKey[]>(`/project/${projectId}/api-keys`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(setKeys)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleGenerate = async () => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;
    const result = await apiFetch<{ apiKey: ApiKey; rawKey: string }>(
      `/project/${projectId}/api-keys`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'Generated Key' }),
      },
    );
    setNewKey(result.rawKey);
    setKeys((prev) => [result.apiKey, ...prev]);
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

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  const planLabel = user?.plan === 'business' ? 'Business' : user?.plan === 'pro' ? 'Pro' : 'Free';
  const planColor = user?.plan === 'business' ? 'bg-purple-100 text-purple-700' : user?.plan === 'pro' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700';

  return (
    <div>
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Plan Section */}
      <div className="mt-6 rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">Plan</h2>
        <div className="mt-2 flex items-center gap-3">
          <span className={`rounded px-3 py-1 text-sm font-medium ${planColor}`}>
            {planLabel}
          </span>
          <span className="text-sm text-gray-500">
            During beta, all features are available.
          </span>
        </div>
        <button
          disabled
          className="mt-3 rounded border px-4 py-2 text-sm text-gray-400 cursor-not-allowed"
        >
          Upgrade — Coming soon
        </button>
      </div>

      {/* API Keys Section */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">API Keys</h2>
        <p className="mt-1 text-sm text-gray-500">
          Use these keys to authenticate the PlanForge SDK.
        </p>

        {isAdmin && (
          <button
            onClick={handleGenerate}
            className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Generate New Key
          </button>
        )}

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
            <div
              key={key.id}
              className="flex items-center justify-between rounded border bg-white p-3"
            >
              <div>
                <span className="font-mono text-sm">{key.keyPrefix}...</span>
                <span className="ml-2 text-sm text-gray-500">{key.name}</span>
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleRevoke(key.id)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
          {keys.length === 0 && (
            <p className="text-sm text-gray-400">No API keys yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

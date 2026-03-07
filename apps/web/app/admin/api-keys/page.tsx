'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import { PageLoader } from '@/components/spinner';
import { updateOnboarding } from '@/lib/onboarding';
import type { ApiKey, Environment } from '@launchpromptly/types';

export default function ApiKeysPage() {
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
    Promise.all([
      apiFetch<ApiKey[]>(`/project/${projectId}/api-keys`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      apiFetch<Environment[]>(`/environment/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => [] as Environment[]),
    ])
      .then(([k, envs]) => {
        setKeys(k);
        setEnvironments(envs);
        if (envs.length > 0) setSelectedEnvId(envs[0]!.id);
      })
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
        body: JSON.stringify({
          name: 'Generated Key',
          ...(selectedEnvId && { environmentId: selectedEnvId }),
        }),
      },
    );
    setNewKey(result.rawKey);
    setKeys((prev) => [result.apiKey, ...prev]);
    updateOnboarding({ apiKeyGenerated: true });
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

  const envNameById = new Map(environments.map((e) => [e.id, e.name]));

  if (loading) {
    return <PageLoader message="Loading API keys..." />;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">API Keys</h1>
      <p className="mt-1 text-sm text-gray-500">
        Use these keys to authenticate the LaunchPromptly SDK. Each key is linked to an environment so events and usage are tracked per environment.
      </p>

      <div className="mt-4 flex items-center gap-3">
        {environments.length > 0 && (
          <select
            value={selectedEnvId}
            onChange={(e) => setSelectedEnvId(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
          >
            {environments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
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
          <div
            key={key.id}
            className="flex items-center justify-between rounded border bg-white p-3"
          >
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
          <div className="rounded-lg border bg-white p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-gray-700">No API keys yet</h3>
            <p className="mt-1 text-sm text-gray-500">Generate your first key to authenticate the SDK with your project.</p>
          </div>
        )}
      </div>
    </div>
  );
}

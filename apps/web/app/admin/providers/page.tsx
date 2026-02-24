'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { OrgProviderKey, LLMProvider } from '@aiecon/types';

const PROVIDERS: { id: LLMProvider; name: string; placeholder: string }[] = [
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-...' },
  { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-...' },
];

export default function ProvidersPage() {
  const [keys, setKeys] = useState<OrgProviderKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch<OrgProviderKey[]>('/provider-keys', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(setKeys)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const configuredProviders = new Set(keys.map((k) => k.provider));

  const handleSave = async (provider: LLMProvider) => {
    const key = inputs[provider]?.trim();
    if (!key) return;
    setError('');
    setSaving(provider);
    const token = getToken();
    if (!token) return;
    try {
      const result = await apiFetch<OrgProviderKey>(
        `/provider-keys/${provider}`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ key }),
        },
      );
      setKeys((prev) => {
        const filtered = prev.filter((k) => k.provider !== provider);
        return [...filtered, result];
      });
      setInputs((prev) => ({ ...prev, [provider]: '' }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(null);
    }
  };

  const handleRemove = async (provider: LLMProvider) => {
    const token = getToken();
    if (!token) return;
    setError('');
    try {
      await apiFetch(`/provider-keys/${provider}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setKeys((prev) => prev.filter((k) => k.provider !== provider));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">LLM Providers</h1>
      <p className="mt-1 text-sm text-gray-500">
        Add your API keys to enable model testing in the Playground and RAG quality evaluation.
      </p>

      {error && <div className="mt-3 text-sm text-red-500">{error}</div>}

      <div className="mt-6 space-y-4">
        {PROVIDERS.map((provider) => {
          const isConfigured = configuredProviders.has(provider.id);
          const keyRecord = keys.find((k) => k.provider === provider.id);
          return (
            <div key={provider.id} className="rounded-lg border bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{provider.name}</span>
                  {isConfigured ? (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Configured
                    </span>
                  ) : (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      Not configured
                    </span>
                  )}
                </div>
                {isConfigured && (
                  <button
                    onClick={() => handleRemove(provider.id)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                )}
              </div>

              {isConfigured && keyRecord && (
                <p className="mt-2 text-xs text-gray-400">
                  Label: {keyRecord.label} &middot; Added{' '}
                  {new Date(keyRecord.createdAt).toLocaleDateString()}
                </p>
              )}

              <div className="mt-3 flex gap-2">
                <input
                  type="password"
                  value={inputs[provider.id] ?? ''}
                  onChange={(e) =>
                    setInputs((prev) => ({ ...prev, [provider.id]: e.target.value }))
                  }
                  placeholder={provider.placeholder}
                  className="flex-1 rounded border px-3 py-2 text-sm"
                />
                <button
                  onClick={() => handleSave(provider.id)}
                  disabled={saving === provider.id || !inputs[provider.id]?.trim()}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving === provider.id
                    ? 'Saving...'
                    : isConfigured
                      ? 'Update'
                      : 'Add Key'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

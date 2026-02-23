'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import type { ManagedPromptWithVersions, ABTest, PromptVersion } from '@aiecon/types';

interface ABTestWithResults extends ABTest {
  results?: {
    variantId: string;
    promptVersionId: string;
    version: number;
    trafficPercent: number;
    callCount: number;
    totalCostUsd: number;
    avgLatencyMs: number;
    avgCostPerCall: number;
  }[];
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-700',
  running: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
};

export default function ABTestsPage() {
  const { promptId } = useParams<{ promptId: string }>();
  const [prompt, setPrompt] = useState<ManagedPromptWithVersions | null>(null);
  const [tests, setTests] = useState<ABTestWithResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState('');
  const [formVariants, setFormVariants] = useState<{ versionId: string; percent: number }[]>([
    { versionId: '', percent: 50 },
    { versionId: '', percent: 50 },
  ]);

  const token = getToken();
  const projectId = getProjectId();

  const loadData = useCallback(() => {
    if (!token || !projectId) {
      setLoading(false);
      return;
    }
    apiFetch<ManagedPromptWithVersions>(
      `/prompt/${projectId}/${promptId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
      .then((p) => {
        setPrompt(p);
        // Load all A/B tests from the prompt's tests
        // For now we'll just display available tests. The tests
        // are fetched individually to get results.
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token, projectId, promptId]);

  useEffect(loadData, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !projectId) return;

    const totalPercent = formVariants.reduce((s, v) => s + v.percent, 0);
    if (totalPercent !== 100) {
      setError('Traffic percentages must sum to 100');
      return;
    }

    setActionLoading('create');
    try {
      const test = await apiFetch<ABTestWithResults>(
        `/prompt/${projectId}/${promptId}/ab-tests`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: formName,
            variants: formVariants.map((v) => ({
              promptVersionId: v.versionId,
              trafficPercent: v.percent,
            })),
          }),
        },
      );
      setTests((prev) => [test, ...prev]);
      setShowCreate(false);
      setFormName('');
      setFormVariants([
        { versionId: '', percent: 50 },
        { versionId: '', percent: 50 },
      ]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStart = async (testId: string) => {
    if (!token || !projectId) return;
    setActionLoading(`start-${testId}`);
    try {
      const updated = await apiFetch<ABTestWithResults>(
        `/prompt/${projectId}/${promptId}/ab-tests/${testId}/start`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
      );
      setTests((prev) => prev.map((t) => (t.id === testId ? updated : t)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async (testId: string) => {
    if (!token || !projectId) return;
    setActionLoading(`stop-${testId}`);
    try {
      const updated = await apiFetch<ABTestWithResults>(
        `/prompt/${projectId}/${promptId}/ab-tests/${testId}/stop`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
      );
      setTests((prev) => prev.map((t) => (t.id === testId ? updated : t)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewResults = async (testId: string) => {
    if (!token || !projectId) return;
    setActionLoading(`results-${testId}`);
    try {
      const result = await apiFetch<ABTestWithResults>(
        `/prompt/${projectId}/${promptId}/ab-tests/${testId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setTests((prev) => prev.map((t) => (t.id === testId ? result : t)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  if (!prompt) {
    return <div className="py-20 text-center text-red-500">Prompt not found</div>;
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-gray-500">
        <Link href="/dashboard/prompts/managed" className="hover:text-gray-700">
          Managed Prompts
        </Link>
        {' > '}
        <Link href={`/dashboard/prompts/managed/${promptId}`} className="hover:text-gray-700">
          {prompt.name}
        </Link>
        {' > '}
        <span className="text-gray-800">A/B Tests</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">A/B Tests</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showCreate ? 'Cancel' : 'New A/B Test'}
        </button>
      </div>

      {error && <div className="mt-3 text-sm text-red-500">{error}</div>}

      {/* Create Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mt-4 space-y-3 rounded-lg border bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Test Name</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              placeholder="Concise vs Detailed v2"
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Variants</label>
            {formVariants.map((variant, i) => (
              <div key={i} className="mt-2 flex items-center gap-2">
                <select
                  value={variant.versionId}
                  onChange={(e) => {
                    const updated = [...formVariants];
                    updated[i] = { versionId: e.target.value, percent: updated[i]?.percent ?? 50 };
                    setFormVariants(updated);
                  }}
                  required
                  className="flex-1 rounded border px-3 py-2 text-sm"
                >
                  <option value="">Select version...</option>
                  {prompt.versions.map((v: PromptVersion) => (
                    <option key={v.id} value={v.id}>
                      v{v.version} ({v.status}) — {v.content.slice(0, 50)}...
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={variant.percent}
                  onChange={(e) => {
                    const updated = [...formVariants];
                    updated[i] = { versionId: updated[i]?.versionId ?? '', percent: parseInt(e.target.value, 10) || 0 };
                    setFormVariants(updated);
                  }}
                  min={1}
                  max={99}
                  className="w-20 rounded border px-3 py-2 text-sm"
                />
                <span className="text-xs text-gray-500">%</span>
              </div>
            ))}
            <p className="mt-1 text-xs text-gray-400">
              Total: {formVariants.reduce((s, v) => s + v.percent, 0)}% (must be 100%)
            </p>
          </div>

          <button
            type="submit"
            disabled={actionLoading === 'create'}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {actionLoading === 'create' ? 'Creating...' : 'Create A/B Test'}
          </button>
        </form>
      )}

      {/* Tests List */}
      {tests.length === 0 ? (
        <div className="mt-12 text-center text-gray-400">
          No A/B tests yet. Create one to compare prompt versions.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {tests.map((test) => (
            <div key={test.id} className="rounded-lg border bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium">{test.name}</h3>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[test.status] ?? 'bg-gray-100'}`}
                  >
                    {test.status}
                  </span>
                </div>
                <div className="flex gap-2">
                  {test.status === 'draft' && (
                    <button
                      onClick={() => handleStart(test.id)}
                      disabled={actionLoading === `start-${test.id}`}
                      className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Start
                    </button>
                  )}
                  {test.status === 'running' && (
                    <button
                      onClick={() => handleStop(test.id)}
                      disabled={actionLoading === `stop-${test.id}`}
                      className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Stop
                    </button>
                  )}
                  <button
                    onClick={() => handleViewResults(test.id)}
                    disabled={actionLoading === `results-${test.id}`}
                    className="rounded border px-3 py-1 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    {actionLoading === `results-${test.id}` ? 'Loading...' : 'View Results'}
                  </button>
                </div>
              </div>

              {/* Variants */}
              <div className="mt-3 text-sm text-gray-600">
                {test.variants.map((v) => (
                  <span key={v.id} className="mr-4">
                    Version {v.promptVersionId.slice(0, 8)}... — {v.trafficPercent}%
                  </span>
                ))}
              </div>

              {/* Results */}
              {test.results && test.results.length > 0 && (
                <div className="mt-4">
                  <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">Results</h4>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase text-gray-500">
                        <th className="pb-1 font-medium">Version</th>
                        <th className="pb-1 font-medium">Traffic</th>
                        <th className="pb-1 font-medium">Calls</th>
                        <th className="pb-1 font-medium">Total Cost</th>
                        <th className="pb-1 font-medium">Avg Latency</th>
                        <th className="pb-1 font-medium">Avg Cost/Call</th>
                      </tr>
                    </thead>
                    <tbody>
                      {test.results.map((r) => (
                        <tr key={r.variantId} className="border-b">
                          <td className="py-2">v{r.version}</td>
                          <td className="py-2">{r.trafficPercent}%</td>
                          <td className="py-2">{r.callCount}</td>
                          <td className="py-2">${r.totalCostUsd.toFixed(4)}</td>
                          <td className="py-2">{Math.round(r.avgLatencyMs)}ms</td>
                          <td className="py-2">${r.avgCostPerCall.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {test.startedAt && (
                <p className="mt-2 text-xs text-gray-400">
                  Started: {new Date(test.startedAt).toLocaleString()}
                  {test.completedAt &&
                    ` | Completed: ${new Date(test.completedAt).toLocaleString()}`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

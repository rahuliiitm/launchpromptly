'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import type { TemplateAnalyticsItem } from '@aiecon/types';

export default function PromptsPage() {
  const [templates, setTemplates] = useState<TemplateAnalyticsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedHash, setExpandedHash] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<Record<string, string>>({});

  useEffect(() => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) {
      setLoading(false);
      return;
    }

    apiFetch<TemplateAnalyticsItem[]>(
      `/analytics/${projectId}/templates`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
      .then(setTemplates)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleAnalyze = async (hash: string) => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    setAnalyzing(hash);
    try {
      const result = await apiFetch<{ analysis: string }>(
        `/analytics/${projectId}/templates/${hash}/analyze`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setAnalysisResults((prev) => ({ ...prev, [hash]: result.analysis }));
    } catch (err) {
      setAnalysisResults((prev) => ({
        ...prev,
        [hash]: `Analysis failed: ${(err as Error).message}`,
      }));
    } finally {
      setAnalyzing(null);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  if (error) {
    return <div className="py-20 text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Prompt Templates</h1>
      <p className="mt-1 text-sm text-gray-500">
        Unique system prompts detected across your AI calls, grouped by content hash.
      </p>

      {templates.length === 0 ? (
        <div className="mt-12 text-center text-gray-400">
          No prompt templates detected yet. Send events with a system prompt to see them here.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {templates.map((t) => (
            <div key={t.systemHash} className="rounded-lg border bg-white">
              {/* Row header */}
              <div
                className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-gray-50"
                onClick={() =>
                  setExpandedHash(expandedHash === t.systemHash ? null : t.systemHash)
                }
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-400">
                    {expandedHash === t.systemHash ? '\u25BC' : '\u25B6'}
                  </span>
                  <div>
                    <span className="font-mono text-xs text-gray-500">
                      {t.systemHash.slice(0, 12)}...
                    </span>
                    {t.normalizedContent && (
                      <p className="mt-0.5 max-w-xl truncate text-sm text-gray-700">
                        {t.normalizedContent.slice(0, 120)}
                        {t.normalizedContent.length > 120 ? '...' : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right">
                    <p className="font-medium">{t.callCount.toLocaleString()} calls</p>
                    <p className="text-xs text-gray-500">
                      ${t.totalCostUsd.toFixed(4)} total
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${t.avgCostPerCall.toFixed(4)}</p>
                    <p className="text-xs text-gray-500">avg/call</p>
                  </div>
                </div>
              </div>

              {/* Expanded content */}
              {expandedHash === t.systemHash && (
                <div className="border-t px-4 py-4">
                  <div className="rounded bg-gray-50 p-3">
                    <p className="mb-1 text-xs font-semibold uppercase text-gray-400">
                      Normalized Prompt Content
                    </p>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-sm text-gray-700">
                      {t.normalizedContent || '(no content available)'}
                    </pre>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={() => handleAnalyze(t.systemHash)}
                      disabled={analyzing === t.systemHash}
                      className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {analyzing === t.systemHash
                        ? 'Analyzing...'
                        : 'Analyze with Claude'}
                    </button>
                    <span className="text-xs text-gray-400">
                      Last seen: {new Date(t.lastSeenAt).toLocaleDateString()}
                    </span>
                  </div>

                  {analysisResults[t.systemHash] && (
                    <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-3">
                      <p className="mb-1 text-xs font-semibold uppercase text-blue-600">
                        Claude Analysis
                      </p>
                      <div className="whitespace-pre-wrap text-sm text-gray-700">
                        {analysisResults[t.systemHash]}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

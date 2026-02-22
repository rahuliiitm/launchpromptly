'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';

interface AdvisoryPanelProps {
  scenarioId: string;
  token: string;
}

interface AdvisoryResponse {
  insight: string;
  generatedAt: string;
}

export function AdvisoryPanel({ scenarioId, token }: AdvisoryPanelProps) {
  const [insight, setInsight] = useState<AdvisoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<AdvisoryResponse>(
        `/scenario/${scenarioId}/advisory`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setInsight(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-medium">AI Advisory</h3>
      <p className="mt-1 text-sm text-gray-500">
        Get AI-powered insights and recommendations for your scenario.
      </p>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Analyzing...' : 'Get AI Insights'}
      </button>

      {error && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {insight && (
        <div className="mt-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
              {insight.insight}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
              <span className="text-xs text-gray-400">
                Generated {new Date(insight.generatedAt).toLocaleString()}
              </span>
              <span className="text-xs text-gray-400">
                AI-generated analysis. Verify before making decisions.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

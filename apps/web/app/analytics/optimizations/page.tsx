'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import type { OptimizationRecommendation } from '@aiecon/types';

const TYPE_BADGES: Record<string, { label: string; className: string }> = {
  model_downgrade: {
    label: 'Model Downgrade',
    className: 'bg-purple-100 text-purple-700',
  },
  verbose_prompt: {
    label: 'Verbose Prompt',
    className: 'bg-orange-100 text-orange-700',
  },
  caching_opportunity: {
    label: 'Caching',
    className: 'bg-cyan-100 text-cyan-700',
  },
};

export default function OptimizationsPage() {
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) {
      setLoading(false);
      return;
    }

    apiFetch<OptimizationRecommendation[]>(
      `/analytics/${projectId}/optimizations`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
      .then(setRecommendations)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  if (error) {
    return <div className="py-20 text-center text-red-500">Error: {error}</div>;
  }

  const totalSavings = recommendations.reduce(
    (sum, r) => sum + r.estimatedSavingsUsd,
    0,
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">Optimizations</h1>
      <p className="mt-1 text-sm text-gray-500">
        Actionable recommendations to reduce your AI costs.
      </p>

      {recommendations.length === 0 ? (
        <div className="mt-12 text-center text-gray-400">
          No optimization opportunities found yet. Keep sending events and check back later.
        </div>
      ) : (
        <>
          {/* Total savings banner */}
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-700">
              Potential savings identified:{' '}
              <span className="text-lg font-bold">${totalSavings.toFixed(2)}</span>
              <span className="ml-1 text-sm font-normal">/month</span>
            </p>
          </div>

          {/* Recommendation cards */}
          <div className="mt-6 space-y-4">
            {recommendations.map((rec, i) => {
              const badge = TYPE_BADGES[rec.type] ?? {
                label: rec.type,
                className: 'bg-gray-100 text-gray-700',
              };

              return (
                <div
                  key={i}
                  className="rounded-lg border bg-white p-5"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                        <h3 className="font-semibold">{rec.title}</h3>
                      </div>
                      <p className="mt-2 text-sm text-gray-600">{rec.description}</p>

                      {rec.currentModel && rec.suggestedModel && (
                        <div className="mt-3 flex items-center gap-2 text-sm">
                          <code className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                            {rec.currentModel}
                          </code>
                          <span className="text-gray-400">{'\u2192'}</span>
                          <code className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                            {rec.suggestedModel}
                          </code>
                        </div>
                      )}
                    </div>

                    <div className="ml-6 text-right">
                      <p className="text-xl font-bold text-green-600">
                        ${rec.estimatedSavingsUsd.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">est. savings/mo</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

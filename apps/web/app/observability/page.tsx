'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import type { RagQualityOverview, RagQualityTimeSeriesPoint } from '@launchpromptly/types';

function ScoreCard({
  label,
  score,
  color,
}: {
  label: string;
  score: number | null;
  color: string;
}) {
  const display = score !== null ? score.toFixed(2) : '—';
  const bgClass =
    score === null
      ? 'bg-gray-50'
      : score > 0.8
        ? 'bg-green-50'
        : score >= 0.5
          ? 'bg-yellow-50'
          : 'bg-red-50';
  const textClass =
    score === null
      ? 'text-gray-400'
      : score > 0.8
        ? 'text-green-700'
        : score >= 0.5
          ? 'text-yellow-700'
          : 'text-red-700';

  return (
    <div className={`rounded-lg border p-4 ${bgClass}`}>
      <div className={`text-2xl font-bold ${textClass}`}>{display}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm text-gray-500">{label}</span>
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-300">—</span>;
  const color =
    score > 0.8
      ? 'bg-green-100 text-green-700'
      : score >= 0.5
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-red-100 text-red-700';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${color}`}>
      {score.toFixed(2)}
    </span>
  );
}

export default function QualityDashboard() {
  const [overview, setOverview] = useState<RagQualityOverview | null>(null);
  const [timeseries, setTimeseries] = useState<RagQualityTimeSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [batchResult, setBatchResult] = useState<{ evaluated: number; errors: number } | null>(null);
  const [days, setDays] = useState(30);

  const fetchData = () => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) {
      setLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };
    setLoading(true);

    Promise.allSettled([
      apiFetch<RagQualityOverview>(`/analytics/${projectId}/rag/quality?days=${days}`, { headers }),
      apiFetch<RagQualityTimeSeriesPoint[]>(`/analytics/${projectId}/rag/quality/timeseries?days=${days}`, { headers }),
    ]).then(([overviewRes, tsRes]) => {
      if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value);
      if (tsRes.status === 'fulfilled') setTimeseries(tsRes.value);
      setLoading(false);
    });
  };

  useEffect(fetchData, [days]);

  const handleEvaluateBatch = async () => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    setEvaluating(true);
    setBatchResult(null);
    try {
      const result = await apiFetch<{ evaluated: number; errors: number }>(
        `/analytics/${projectId}/rag/evaluate-batch?limit=20`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
      );
      setBatchResult(result);
      fetchData();
    } catch {
      setBatchResult({ evaluated: 0, errors: 1 });
    } finally {
      setEvaluating(false);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  if (!overview) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Quality</h1>
        <div className="mt-8 rounded-lg border bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-700">No RAG data yet</h2>
          <p className="mt-2 text-sm text-gray-500">
            Start sending RAG context with your SDK events to evaluate quality.
          </p>
          <Link
            href="/admin/sdk"
            className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            View SDK Setup
          </Link>
        </div>
      </div>
    );
  }

  const totalTraces = overview.totalEvaluated + overview.totalUnevaluated;
  const hasEvaluations = overview.totalEvaluated > 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quality</h1>
          <p className="mt-1 text-sm text-gray-500">
            LLM-as-judge evaluation of your RAG pipeline quality
          </p>
        </div>
        <div className="flex gap-1 rounded border bg-white p-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded px-3 py-1 text-xs font-medium ${
                days === d ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Score Summary Cards */}
      <div className="mt-6 grid grid-cols-4 gap-4">
        <ScoreCard label="Faithfulness" score={overview.avgFaithfulness} color="#3b82f6" />
        <ScoreCard label="Answer Relevance" score={overview.avgRelevance} color="#10b981" />
        <ScoreCard label="Context Relevance" score={overview.avgContextRelevance} color="#f59e0b" />
        <div className="rounded-lg border bg-white p-4">
          <div className="text-2xl font-bold">
            {overview.totalEvaluated}
            <span className="text-base font-normal text-gray-400">/{totalTraces}</span>
          </div>
          <div className="mt-1 text-sm text-gray-500">Evaluated</div>
        </div>
      </div>

      {/* Evaluate batch action */}
      {overview.totalUnevaluated > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
          <span className="text-sm text-blue-700">
            {overview.totalUnevaluated} un-evaluated traces
          </span>
          <button
            onClick={handleEvaluateBatch}
            disabled={evaluating}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {evaluating ? 'Evaluating...' : 'Evaluate Recent'}
          </button>
          {batchResult && (
            <span className="text-xs text-gray-500">
              {batchResult.evaluated} evaluated{batchResult.errors > 0 ? `, ${batchResult.errors} errors` : ''}
            </span>
          )}
        </div>
      )}

      {/* Score Distribution */}
      {hasEvaluations && (
        <div className="mt-6 rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Score Distribution
          </h2>
          <div className="mt-3 flex items-center gap-6">
            {[
              { label: 'Good', value: overview.scoreDistribution.good, color: 'bg-green-500', desc: '> 0.8' },
              { label: 'Fair', value: overview.scoreDistribution.fair, color: 'bg-yellow-500', desc: '0.5 – 0.8' },
              { label: 'Poor', value: overview.scoreDistribution.poor, color: 'bg-red-500', desc: '< 0.5' },
            ].map((bucket) => {
              const pct = overview.totalEvaluated > 0
                ? Math.round((bucket.value / overview.totalEvaluated) * 100)
                : 0;
              return (
                <div key={bucket.label} className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${bucket.color}`} />
                  <div>
                    <span className="text-sm font-medium">{bucket.label}</span>
                    <span className="ml-1 text-xs text-gray-400">({bucket.desc})</span>
                    <span className="ml-2 text-sm font-bold">{pct}%</span>
                    <span className="ml-1 text-xs text-gray-400">({bucket.value})</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quality Trend Chart */}
      {timeseries.length > 1 && (
        <div className="mt-6 rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Quality Trend
          </h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeseries}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => d.slice(5)}
                  tick={{ fontSize: 12 }}
                />
                <YAxis domain={[0, 1]} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [Number(value)?.toFixed(2) ?? '—']}
                />
                <Legend />
                <Line type="monotone" dataKey="avgFaithfulness" name="Faithfulness" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="avgRelevance" name="Answer Relevance" stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="avgContextRelevance" name="Context Relevance" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Pipeline Comparison */}
      {overview.pipelineBreakdown.length > 0 && (
        <div className="mt-6 rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Pipeline Comparison
            </h2>
            <Link
              href="/observability/flows"
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              View all flows &rarr;
            </Link>
          </div>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">Pipeline</th>
                <th className="pb-2 font-medium text-right">Evaluated</th>
                <th className="pb-2 font-medium text-right">Faithfulness</th>
                <th className="pb-2 font-medium text-right">Answer Rel.</th>
                <th className="pb-2 font-medium text-right">Context Rel.</th>
              </tr>
            </thead>
            <tbody>
              {overview.pipelineBreakdown.map((p) => (
                <tr key={p.pipelineId} className="border-b last:border-0">
                  <td className="py-2">
                    <Link
                      href={`/observability/flows?pipeline=${encodeURIComponent(p.pipelineId)}`}
                      className="font-medium text-blue-600 hover:text-blue-800"
                    >
                      {p.pipelineId}
                    </Link>
                  </td>
                  <td className="py-2 text-right">{p.evaluatedCount}</td>
                  <td className="py-2 text-right"><ScoreBadge score={p.avgFaithfulness} /></td>
                  <td className="py-2 text-right"><ScoreBadge score={p.avgRelevance} /></td>
                  <td className="py-2 text-right"><ScoreBadge score={p.avgContextRelevance} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty evaluated state */}
      {!hasEvaluations && totalTraces > 0 && (
        <div className="mt-6 rounded-lg border bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-700">No evaluations yet</h2>
          <p className="mt-2 text-sm text-gray-500">
            Click &ldquo;Evaluate Recent&rdquo; above to run LLM-as-judge quality scoring on your RAG traces,
            or evaluate individual traces from the{' '}
            <Link href="/observability/flows" className="text-blue-600 underline">
              Flows
            </Link>{' '}
            page.
          </p>
        </div>
      )}
    </div>
  );
}

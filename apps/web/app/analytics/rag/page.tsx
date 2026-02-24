'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import type { RagOverview, RagTimeSeriesPoint } from '@aiecon/types';

export default function RagDashboard() {
  const [overview, setOverview] = useState<RagOverview | null>(null);
  const [timeseries, setTimeseries] = useState<RagTimeSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) {
      setLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    setLoading(true);
    Promise.allSettled([
      apiFetch<RagOverview>(`/analytics/${projectId}/rag/overview?days=${days}`, { headers }),
      apiFetch<RagTimeSeriesPoint[]>(`/analytics/${projectId}/rag/timeseries?days=${days}`, { headers }),
    ]).then(([overviewRes, tsRes]) => {
      if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value);
      if (tsRes.status === 'fulfilled') setTimeseries(tsRes.value);
      setLoading(false);
    });
  }, [days]);

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  if (!overview || overview.totalRagCalls === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold">RAG Quality</h1>
        <div className="mt-8 rounded-lg border bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-700">No RAG data yet</h2>
          <p className="mt-2 text-sm text-gray-500">
            Start sending RAG context with your SDK events to see quality metrics here.
          </p>
          <Link
            href="/settings/sdk"
            className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            View SDK Setup
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">RAG Quality</h1>
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

      {/* Summary Cards */}
      <div className="mt-6 grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-2xl font-bold">{overview.totalRagCalls.toLocaleString()}</div>
          <div className="mt-1 text-sm text-gray-500">RAG Queries</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-2xl font-bold">{overview.avgRetrievalMs}ms</div>
          <div className="mt-1 text-sm text-gray-500">Avg Retrieval</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-2xl font-bold">{overview.avgChunkCount}</div>
          <div className="mt-1 text-sm text-gray-500">Avg Chunks/Query</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-2xl font-bold">${overview.totalCostUsd.toFixed(2)}</div>
          <div className="mt-1 text-sm text-gray-500">Total RAG Cost</div>
        </div>
      </div>

      {/* Time Series Chart */}
      {timeseries.length > 0 && (
        <div className="mt-8 rounded-lg border bg-white p-4">
          <h2 className="text-lg font-semibold">Daily RAG Queries</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeseries}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => d.slice(5)}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [Number(value).toLocaleString(), 'RAG Queries']}
                />
                <Area
                  type="monotone"
                  dataKey="ragCalls"
                  stroke="#3b82f6"
                  fill="#93c5fd"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Pipeline Breakdown */}
      {overview.pipelineBreakdown.length > 0 && (
        <div className="mt-8 rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Pipelines</h2>
            <Link
              href="/analytics/rag/traces"
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              View all traces &rarr;
            </Link>
          </div>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">Pipeline</th>
                <th className="pb-2 font-medium text-right">Queries</th>
                <th className="pb-2 font-medium text-right">Avg Retrieval</th>
                <th className="pb-2 font-medium text-right">Avg Chunks</th>
                <th className="pb-2 font-medium text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {overview.pipelineBreakdown.map((p) => (
                <tr key={p.pipelineId} className="border-b last:border-0">
                  <td className="py-2">
                    <Link
                      href={`/analytics/rag/traces?pipeline=${encodeURIComponent(p.pipelineId)}`}
                      className="font-medium text-blue-600 hover:text-blue-800"
                    >
                      {p.pipelineId}
                    </Link>
                  </td>
                  <td className="py-2 text-right">{p.callCount.toLocaleString()}</td>
                  <td className="py-2 text-right">{p.avgRetrievalMs}ms</td>
                  <td className="py-2 text-right">{p.avgChunkCount}</td>
                  <td className="py-2 text-right">${p.totalCostUsd.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

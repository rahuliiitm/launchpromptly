'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import type { OverviewAnalytics, TimeSeriesPoint, PromptAnalyticsItem } from '@aiecon/types';
import Link from 'next/link';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsOverview() {
  const [overview, setOverview] = useState<OverviewAnalytics | null>(null);
  const [timeseries, setTimeseries] = useState<TimeSeriesPoint[]>([]);
  const [promptBreakdown, setPromptBreakdown] = useState<PromptAnalyticsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) {
      setLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      apiFetch<OverviewAnalytics>(`/analytics/${projectId}/overview`, { headers }),
      apiFetch<TimeSeriesPoint[]>(`/analytics/${projectId}/timeseries`, { headers }),
      apiFetch<PromptAnalyticsItem[]>(`/analytics/${projectId}/prompts`, { headers }).catch(() => [] as PromptAnalyticsItem[]),
    ])
      .then(([ov, ts, pb]) => {
        setOverview(ov);
        setTimeseries(ts);
        setPromptBreakdown(pb);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading analytics...</div>;
  }

  if (error) {
    return <div className="py-20 text-center text-red-500">Error: {error}</div>;
  }

  if (!overview || overview.totalCalls === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-xl font-semibold text-gray-700">No data yet</h2>
        <p className="mt-2 text-gray-500">
          Set up your SDK to start tracking AI costs.{' '}
          <Link href="/settings/sdk" className="text-blue-600 underline">
            Get started
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Overview</h1>
      <p className="mt-1 text-sm text-gray-500">Last {overview.periodDays} days</p>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-gray-500">Total Spend</p>
          <p className="mt-1 text-2xl font-bold">${overview.totalCostUsd.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-gray-500">Total Calls</p>
          <p className="mt-1 text-2xl font-bold">{overview.totalCalls.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-gray-500">Avg Latency</p>
          <p className="mt-1 text-2xl font-bold">{overview.avgLatencyMs}ms</p>
        </div>
      </div>

      {/* Time series chart */}
      {timeseries.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Daily Cost</h2>
          <div className="mt-4 h-64 rounded-lg border bg-white p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeseries}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(value) => [`$${Number(value).toFixed(4)}`, 'Cost']} />
                <Area
                  type="monotone"
                  dataKey="costUsd"
                  stroke="#3b82f6"
                  fill="#93c5fd"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Model breakdown */}
      {overview.modelBreakdown.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Cost by Model</h2>
          <div className="mt-4 flex items-center gap-8 rounded-lg border bg-white p-4">
            <div className="h-48 w-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={overview.modelBreakdown}
                    dataKey="totalCostUsd"
                    nameKey="model"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                  >
                    {overview.modelBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${Number(value).toFixed(4)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {overview.modelBreakdown.map((m, i) => (
                <div key={m.model} className="flex items-center gap-2 text-sm">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="font-medium">{m.model}</span>
                  <span className="text-gray-500">
                    ${m.totalCostUsd.toFixed(2)} ({m.callCount} calls)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Per-prompt breakdown */}
      {promptBreakdown.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Cost by Prompt</h2>
          <div className="mt-4 rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500">
                  <th className="px-4 py-3 font-medium">Prompt</th>
                  <th className="px-4 py-3 font-medium text-right">Calls</th>
                  <th className="px-4 py-3 font-medium text-right">Cost</th>
                  <th className="px-4 py-3 font-medium text-right">Avg Latency</th>
                </tr>
              </thead>
              <tbody>
                {promptBreakdown.map((p) => (
                  <tr key={p.promptId} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/prompts/managed/${p.promptId}`}
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        {p.promptName}
                      </Link>
                      <span className="ml-2 text-xs text-gray-400">{p.promptSlug}</span>
                    </td>
                    <td className="px-4 py-3 text-right">{p.callCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">${p.totalCostUsd.toFixed(4)}</td>
                    <td className="px-4 py-3 text-right">{p.avgLatencyMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

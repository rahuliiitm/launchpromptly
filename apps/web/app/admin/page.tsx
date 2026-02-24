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
import { useAuth } from '@/lib/auth-context';
import type { OverviewAnalytics, TimeSeriesPoint, PromptAnalyticsItem } from '@aiecon/types';
import Link from 'next/link';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function BillingPage() {
  const { user } = useAuth();
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
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  if (error) {
    return <div className="py-20 text-center text-red-500">Error: {error}</div>;
  }

  const planLabel = user?.plan === 'business' ? 'Business' : user?.plan === 'pro' ? 'Pro' : 'Free';
  const planColor = user?.plan === 'business' ? 'bg-purple-100 text-purple-700' : user?.plan === 'pro' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700';

  return (
    <div>
      <h1 className="text-2xl font-bold">Billing</h1>
      <p className="mt-1 text-sm text-gray-500">Subscription and usage overview</p>

      {/* Subscription */}
      <div className="mt-6 rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Subscription</h2>
        <div className="mt-3 flex items-center gap-3">
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

      {/* Usage Stats */}
      {!overview || overview.totalCalls === 0 ? (
        <div className="mt-8 rounded-lg border bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-700">No usage data yet</h2>
          <p className="mt-2 text-sm text-gray-500">
            Set up your SDK to start tracking AI costs.{' '}
            <Link href="/admin/sdk" className="text-blue-600 underline">
              Get started
            </Link>
          </p>
        </div>
      ) : (
        <>
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Usage — Last {overview.periodDays} days
          </h2>

          <div className="mt-3 grid grid-cols-3 gap-4">
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

          {timeseries.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-500">Daily Cost</h3>
              <div className="mt-3 h-64 rounded-lg border bg-white p-4">
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

          {overview.modelBreakdown.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-500">Cost by Model</h3>
              <div className="mt-3 flex items-center gap-8 rounded-lg border bg-white p-4">
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

          {promptBreakdown.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-500">Cost by Prompt</h3>
              <div className="mt-3 rounded-lg border bg-white">
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
        </>
      )}
    </div>
  );
}

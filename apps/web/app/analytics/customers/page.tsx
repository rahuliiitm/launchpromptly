'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import type { CustomerAnalyticsItem } from '@aiecon/types';

const DAYS_OPTIONS = [7, 30, 90];

export default function CustomerAnalyticsPage() {
  const [customers, setCustomers] = useState<CustomerAnalyticsItem[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<keyof CustomerAnalyticsItem>('totalCostUsd');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    apiFetch<CustomerAnalyticsItem[]>(
      `/analytics/${projectId}/customers?days=${days}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
      .then(setCustomers)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [days]);

  const handleSort = (key: keyof CustomerAnalyticsItem) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sorted = [...customers].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortAsc ? aVal - bVal : bVal - aVal;
    }
    return sortAsc
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const top10 = sorted.slice(0, 10);

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  if (error) {
    return <div className="py-20 text-center text-red-500">Error: {error}</div>;
  }

  const sortIndicator = (key: keyof CustomerAnalyticsItem) =>
    sortKey === key ? (sortAsc ? ' \u2191' : ' \u2193') : '';

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customer Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Per-customer cost breakdown and usage analytics
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded border px-3 py-1.5 text-sm"
        >
          {DAYS_OPTIONS.map((d) => (
            <option key={d} value={d}>
              Last {d} days
            </option>
          ))}
        </select>
      </div>

      {customers.length === 0 ? (
        <div className="mt-12 text-center text-gray-400">
          No customer data yet. Events with a <code>customerId</code> will appear here.
        </div>
      ) : (
        <>
          {/* Bar chart — top 10 customers */}
          <div className="mt-6 h-64 rounded-lg border bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-600">Top Customers by Cost</h2>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="customerId"
                  tick={{ fontSize: 11 }}
                  width={80}
                />
                <Tooltip formatter={(value) => [`$${Number(value).toFixed(4)}`, 'Cost']} />
                <Bar dataKey="totalCostUsd" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="mt-6 overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th
                    className="cursor-pointer px-4 py-3"
                    onClick={() => handleSort('customerId')}
                  >
                    Customer ID{sortIndicator('customerId')}
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 text-right"
                    onClick={() => handleSort('totalCostUsd')}
                  >
                    Total Cost{sortIndicator('totalCostUsd')}
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 text-right"
                    onClick={() => handleSort('callCount')}
                  >
                    Calls{sortIndicator('callCount')}
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 text-right"
                    onClick={() => handleSort('avgCostPerCall')}
                  >
                    Avg Cost/Call{sortIndicator('avgCostPerCall')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((c) => (
                  <tr key={c.customerId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm">{c.customerId}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      ${c.totalCostUsd.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-right">{c.callCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">${c.avgCostPerCall.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

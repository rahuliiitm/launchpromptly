'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { FinancialResult, RiskLevel } from '@aiecon/types';

interface SnapshotManagerProps {
  scenarioId: string;
  token: string;
}

interface SnapshotWithFinancials {
  id: string;
  scenarioId: string;
  label: string;
  model: string;
  avgInputTokens: number;
  avgOutputTokens: number;
  requestsPerUser: number;
  projectedUsers: number;
  subscriptionPrice: number;
  createdAt: string;
  financialResult: FinancialResult;
}

interface ComparisonResult {
  snapshots: SnapshotWithFinancials[];
}

function getRiskBadge(risk: RiskLevel) {
  const styles: Record<RiskLevel, string> = {
    Low: 'bg-green-100 text-green-800',
    Medium: 'bg-yellow-100 text-yellow-800',
    High: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${styles[risk]}`}>
      {risk}
    </span>
  );
}

export function SnapshotManager({ scenarioId, token }: SnapshotManagerProps) {
  const [snapshots, setSnapshots] = useState<SnapshotWithFinancials[]>([]);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [comparing, setComparing] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const loadSnapshots = async () => {
    try {
      const data = await apiFetch<SnapshotWithFinancials[]>(
        `/scenario/${scenarioId}/snapshots`,
        { headers },
      );
      setSnapshots(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load snapshots');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId]);

  const handleSave = async () => {
    if (!label.trim()) return;
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/scenario/${scenarioId}/snapshots`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ label: label.trim() }),
      });
      setLabel('');
      await loadSnapshots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save snapshot');
    } finally {
      setSaving(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      }
      return next;
    });
  };

  const handleCompare = async () => {
    if (selected.size < 2) return;
    setComparing(true);
    setError('');
    try {
      const data = await apiFetch<ComparisonResult>('/scenario/snapshots/compare', {
        method: 'POST',
        headers,
        body: JSON.stringify({ snapshotIds: [...selected] }),
      });
      setComparison(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare');
    } finally {
      setComparing(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-medium">Scenario Snapshots</h3>
      <p className="mt-1 text-sm text-gray-500">
        Save named snapshots and compare them side-by-side.
      </p>

      <div className="mt-4 flex gap-3">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Q1 Plan"
          maxLength={100}
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={handleSave}
          disabled={saving || !label.trim()}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Snapshot'}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Loading snapshots...</p>
      ) : snapshots.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No snapshots yet. Save one above.</p>
      ) : (
        <div className="mt-4">
          <div className="space-y-2">
            {snapshots.map((snap) => (
              <label
                key={snap.id}
                className="flex items-center gap-3 rounded border border-gray-200 p-3 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(snap.id)}
                  onChange={() => toggleSelect(snap.id)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <div className="flex-1">
                  <span className="font-medium text-sm">{snap.label}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    {new Date(snap.createdAt).toLocaleString()}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  Margin: {snap.financialResult.grossMargin.toFixed(1)}%
                </span>
                {getRiskBadge(snap.financialResult.riskLevel)}
              </label>
            ))}
          </div>

          <button
            onClick={handleCompare}
            disabled={comparing || selected.size < 2}
            className="mt-3 rounded bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-900 disabled:opacity-50"
          >
            {comparing ? 'Comparing...' : `Compare (${selected.size} selected)`}
          </button>
        </div>
      )}

      {comparison && (
        <div className="mt-6">
          <h4 className="text-md font-medium">Comparison</h4>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Metric</th>
                  {comparison.snapshots.map((snap) => (
                    <th key={snap.id} className="px-4 py-2 text-right font-medium text-gray-700">
                      {snap.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Model</td>
                  {comparison.snapshots.map((s) => (
                    <td key={s.id} className="px-4 py-2 text-right">{s.model}</td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Users</td>
                  {comparison.snapshots.map((s) => (
                    <td key={s.id} className="px-4 py-2 text-right">{s.projectedUsers.toLocaleString()}</td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Price</td>
                  {comparison.snapshots.map((s) => (
                    <td key={s.id} className="px-4 py-2 text-right">${s.subscriptionPrice}</td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Cost/User</td>
                  {comparison.snapshots.map((s) => (
                    <td key={s.id} className="px-4 py-2 text-right">${s.financialResult.costPerUser.toFixed(4)}</td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Monthly Cost</td>
                  {comparison.snapshots.map((s) => (
                    <td key={s.id} className="px-4 py-2 text-right">
                      ${s.financialResult.monthlyCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Margin</td>
                  {comparison.snapshots.map((s) => (
                    <td key={s.id} className="px-4 py-2 text-right">{s.financialResult.grossMargin.toFixed(2)}%</td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Risk</td>
                  {comparison.snapshots.map((s) => (
                    <td key={s.id} className="px-4 py-2 text-right">{getRiskBadge(s.financialResult.riskLevel)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

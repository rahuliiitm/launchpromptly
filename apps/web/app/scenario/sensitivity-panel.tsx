'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { RiskLevel, SensitivityDataPoint } from '@aiecon/types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface SensitivityPanelProps {
  scenarioId: string;
  token: string;
}

interface SensitivityResponse {
  parameter: string;
  dataPoints: SensitivityDataPoint[];
}

const PARAMETERS = [
  { value: 'projectedUsers', label: 'Projected Users' },
  { value: 'subscriptionPrice', label: 'Subscription Price' },
  { value: 'requestsPerUser', label: 'Requests per User' },
  { value: 'avgInputTokens', label: 'Avg Input Tokens' },
  { value: 'avgOutputTokens', label: 'Avg Output Tokens' },
];

function getRiskColor(risk: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    Low: 'text-green-600',
    Medium: 'text-yellow-600',
    High: 'text-red-600',
  };
  return colors[risk];
}

export function SensitivityPanel({ scenarioId, token }: SensitivityPanelProps) {
  const [parameter, setParameter] = useState('projectedUsers');
  const [rangeMin, setRangeMin] = useState('');
  const [rangeMax, setRangeMax] = useState('');
  const [steps, setSteps] = useState('10');
  const [result, setResult] = useState<SensitivityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRun = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch<SensitivityResponse>(
        `/scenario/${scenarioId}/sensitivity`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            parameter,
            rangeMin: parseFloat(rangeMin),
            rangeMax: parseFloat(rangeMax),
            steps: parseInt(steps, 10),
          }),
        },
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run analysis');
    } finally {
      setLoading(false);
    }
  };

  const paramLabel = PARAMETERS.find((p) => p.value === parameter)?.label ?? parameter;

  return (
    <div>
      <h3 className="text-lg font-medium">Sensitivity Analysis</h3>
      <p className="mt-1 text-sm text-gray-500">
        Vary one parameter to see how it affects your economics.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Parameter</label>
          <select
            value={parameter}
            onChange={(e) => setParameter(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {PARAMETERS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Range Min</label>
          <input
            type="number"
            min="0"
            value={rangeMin}
            onChange={(e) => setRangeMin(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="e.g. 100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Range Max</label>
          <input
            type="number"
            min="0"
            value={rangeMax}
            onChange={(e) => setRangeMax(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="e.g. 5000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Steps</label>
          <input
            type="number"
            min="2"
            max="50"
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <button
        onClick={handleRun}
        disabled={loading || !rangeMin || !rangeMax}
        className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Running...' : 'Run Analysis'}
      </button>

      {error && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.dataPoints}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="parameterValue"
                  tick={{ fontSize: 12 }}
                  label={{ value: paramLabel, position: 'insideBottom', offset: -5, fontSize: 12 }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Gross Margin %', angle: -90, position: 'insideLeft', fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Margin']}
                  labelFormatter={(label) => `${paramLabel}: ${Number(label).toLocaleString()}`}
                />
                <Line
                  type="monotone"
                  dataKey="grossMargin"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-2 text-left font-medium text-gray-700">{paramLabel}</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">Cost/Request</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">Cost/User</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">Monthly Cost</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">Margin</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-700">Risk</th>
                </tr>
              </thead>
              <tbody>
                {result.dataPoints.map((dp, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-2">{dp.parameterValue.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">${dp.costPerRequest.toFixed(6)}</td>
                    <td className="px-4 py-2 text-right">${dp.costPerUser.toFixed(4)}</td>
                    <td className="px-4 py-2 text-right">${dp.monthlyCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2 text-right">{dp.grossMargin.toFixed(2)}%</td>
                    <td className={`px-4 py-2 text-center font-medium ${getRiskColor(dp.riskLevel)}`}>
                      {dp.riskLevel}
                    </td>
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

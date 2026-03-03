'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import { PageLoader } from '@/components/spinner';

interface SecurityOverview {
  totalEvents: number;
  eventsWithPii: number;
  piiExposureRate: number;
  totalPiiDetections: number;
  injectionAttempts: number;
  injectionBlocked: number;
  redactionRate: number;
  topPiiTypes: { type: string; count: number }[];
  periodDays: number;
}

interface SecurityTimeSeriesPoint {
  date: string;
  piiDetections: number;
  injectionAttempts: number;
  injectionBlocked: number;
  eventsWithRedaction: number;
  totalEvents: number;
}

interface InjectionAnalysis {
  totalAttempts: number;
  blocked: number;
  warned: number;
  allowed: number;
  avgRiskScore: number;
  topTriggered: { category: string; count: number }[];
}

const PERIOD_OPTIONS = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

export default function SecurityOverviewPage() {
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [timeseries, setTimeseries] = useState<SecurityTimeSeriesPoint[]>([]);
  const [injections, setInjections] = useState<InjectionAnalysis | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      apiFetch<SecurityOverview>(
        `/analytics/${projectId}/security/overview?days=${days}`,
        { headers },
      ),
      apiFetch<SecurityTimeSeriesPoint[]>(
        `/analytics/${projectId}/security/timeseries?days=${days}`,
        { headers },
      ),
      apiFetch<InjectionAnalysis>(
        `/analytics/${projectId}/security/injections?days=${days}`,
        { headers },
      ),
    ])
      .then(([ov, ts, inj]) => {
        setOverview(ov);
        setTimeseries(ts);
        setInjections(inj);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return <PageLoader message="Loading security data..." />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-20">
        <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-center">
          <p className="font-medium text-red-700">Failed to load security data</p>
          <p className="mt-1 text-sm text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  const piiRateColor =
    overview && overview.piiExposureRate > 10
      ? 'text-red-600'
      : overview && overview.piiExposureRate > 5
        ? 'text-yellow-600'
        : 'text-green-600';

  const redactionRateColor =
    overview && overview.redactionRate > 90 ? 'text-green-600' : 'text-yellow-600';

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Security</h1>
          <p className="mt-1 text-sm text-gray-500">
            PII detection, injection protection, and security analytics
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border bg-white p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                days === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {!overview || overview.totalEvents === 0 ? (
        <div className="mt-8 rounded-lg border bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-700">No security data yet</h2>
          <p className="mt-2 text-sm text-gray-500">
            Security events will appear here once the SDK starts processing requests
            with PII detection and injection protection enabled.
          </p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="mt-6 grid grid-cols-4 gap-4">
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm text-gray-500">PII Exposure Rate</p>
              <p className={`mt-1 text-2xl font-bold ${piiRateColor}`}>
                {overview.piiExposureRate.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {overview.eventsWithPii.toLocaleString()} events with PII
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm text-gray-500">Injection Attempts</p>
              <p className="mt-1 text-2xl font-bold text-red-600">
                {overview.injectionAttempts.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {overview.injectionBlocked.toLocaleString()} blocked
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm text-gray-500">Redaction Rate</p>
              <p className={`mt-1 text-2xl font-bold ${redactionRateColor}`}>
                {overview.redactionRate.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm text-gray-500">Total PII Detections</p>
              <p className="mt-1 text-2xl font-bold">
                {overview.totalPiiDetections.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Security Activity Timeline */}
          {timeseries.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-500">
                Security Activity Timeline
              </h3>
              <div className="mt-3 h-64 rounded-lg border bg-white p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeseries}>
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="piiDetections"
                      name="PII Detections"
                      stroke="#3b82f6"
                      fill="#93c5fd"
                      fillOpacity={0.3}
                    />
                    <Area
                      type="monotone"
                      dataKey="injectionAttempts"
                      name="Injection Attempts"
                      stroke="#ef4444"
                      fill="#fca5a5"
                      fillOpacity={0.3}
                    />
                    <Area
                      type="monotone"
                      dataKey="eventsWithRedaction"
                      name="Redacted Events"
                      stroke="#10b981"
                      fill="#6ee7b7"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* PII Types Breakdown */}
          {overview.topPiiTypes.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-500">
                PII Types Breakdown
              </h3>
              <div className="mt-3 h-64 rounded-lg border bg-white p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={overview.topPiiTypes}
                    layout="vertical"
                    margin={{ left: 80 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="type"
                      tick={{ fontSize: 12 }}
                      width={75}
                    />
                    <Tooltip />
                    <Bar dataKey="count" name="Detections" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Injection Analysis */}
          {injections && injections.totalAttempts > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-500">
                Injection Analysis
              </h3>
              <div className="mt-3 rounded-lg border bg-white p-4">
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Blocked</p>
                    <p className="mt-0.5 text-lg font-bold text-green-600">
                      {injections.blocked.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Warned</p>
                    <p className="mt-0.5 text-lg font-bold text-yellow-600">
                      {injections.warned.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Allowed</p>
                    <p className="mt-0.5 text-lg font-bold text-gray-600">
                      {injections.allowed.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Avg Risk Score</p>
                    <p className="mt-0.5 text-lg font-bold">
                      {injections.avgRiskScore.toFixed(2)}
                    </p>
                  </div>
                </div>
                {injections.topTriggered.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-gray-400">
                      Top Triggered Categories
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {injections.topTriggered.map((t) => (
                        <span
                          key={t.category}
                          className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700"
                        >
                          {t.category}
                          <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-xs">
                            {t.count}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

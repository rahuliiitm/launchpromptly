'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import { PageLoader } from '@/components/spinner';

interface AuditLog {
  id: string;
  projectId: string;
  eventType: string;
  severity: string;
  details: Record<string, unknown>;
  eventId: string | null;
  customerId: string | null;
  createdAt: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

interface AuditSummary {
  total: number;
  byEventType: { eventType: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  periodDays: number;
}

const EVENT_TYPES = [
  { label: 'All', value: '' },
  { label: 'PII Detected', value: 'pii_detected' },
  { label: 'Injection Blocked', value: 'injection_blocked' },
  { label: 'Injection Warned', value: 'injection_warned' },
  { label: 'Content Violation', value: 'content_violation' },
  { label: 'Cost Limit', value: 'cost_limit' },
  { label: 'Compliance Issue', value: 'compliance_issue' },
];

const SEVERITIES = [
  { label: 'All', value: '' },
  { label: 'Info', value: 'info' },
  { label: 'Warning', value: 'warning' },
  { label: 'Critical', value: 'critical' },
];

const PERIOD_OPTIONS = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

const PAGE_SIZE = 20;

function severityBadgeClass(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-700';
    case 'warning':
      return 'bg-yellow-100 text-yellow-700';
    case 'info':
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function eventTypeBadgeClass(eventType: string): string {
  switch (eventType) {
    case 'injection_blocked':
      return 'bg-red-50 text-red-700';
    case 'injection_warned':
      return 'bg-yellow-50 text-yellow-700';
    case 'pii_detected':
      return 'bg-blue-50 text-blue-700';
    case 'content_violation':
      return 'bg-purple-50 text-purple-700';
    case 'cost_limit':
      return 'bg-orange-50 text-orange-700';
    case 'compliance_issue':
      return 'bg-red-50 text-red-700';
    default:
      return 'bg-gray-50 text-gray-700';
  }
}

function formatEventType(eventType: string): string {
  return eventType
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [eventType, setEventType] = useState('');
  const [severity, setSeverity] = useState('');
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const headers = { Authorization: `Bearer ${token}` };

    const queryParams = new URLSearchParams();
    if (eventType) queryParams.set('eventType', eventType);
    if (severity) queryParams.set('severity', severity);
    queryParams.set('page', String(page));
    queryParams.set('limit', String(PAGE_SIZE));
    queryParams.set('days', String(days));

    Promise.all([
      apiFetch<AuditLogsResponse>(
        `/v1/security/audit/${projectId}?${queryParams.toString()}`,
        { headers },
      ),
      apiFetch<AuditSummary>(
        `/v1/security/audit/${projectId}/summary?days=${days}`,
        { headers },
      ),
    ])
      .then(([logsRes, summaryRes]) => {
        setLogs(logsRes.logs);
        setTotal(logsRes.total);
        setSummary(summaryRes);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [eventType, severity, days, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [eventType, severity, days]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const summaryBySeverity = (sev: string): number => {
    if (!summary) return 0;
    const found = summary.bySeverity.find((s) => s.severity === sev);
    return found ? found.count : 0;
  };

  if (loading && logs.length === 0) {
    return <PageLoader message="Loading audit logs..." />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-20">
        <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-center">
          <p className="font-medium text-red-700">Failed to load audit logs</p>
          <p className="mt-1 text-sm text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Audit Logs</h1>
      <p className="mt-1 text-sm text-gray-500">
        Security event log with filtering and severity tracking
      </p>

      {/* Summary cards */}
      {summary && (
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="rounded-lg border bg-white p-4">
            <p className="text-sm text-gray-500">Total Events</p>
            <p className="mt-1 text-2xl font-bold">
              {summary.total.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <p className="text-sm text-gray-500">Info</p>
            <p className="mt-1 text-2xl font-bold text-gray-600">
              {summaryBySeverity('info').toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <p className="text-sm text-gray-500">Warning</p>
            <p className="mt-1 text-2xl font-bold text-yellow-600">
              {summaryBySeverity('warning').toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <p className="text-sm text-gray-500">Critical</p>
            <p className="mt-1 text-2xl font-bold text-red-600">
              {summaryBySeverity('critical').toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
        >
          {EVENT_TYPES.map((et) => (
            <option key={et.value} value={et.value}>
              {et.label}
            </option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
        >
          {SEVERITIES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
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

      {/* Audit log table */}
      <div className="mt-4 rounded-lg border bg-white">
        {logs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h3 className="mt-4 text-sm font-semibold text-gray-700">No audit logs yet</h3>
            <p className="mt-1 text-sm text-gray-500">Every guardrail decision is recorded here — PII detections, injection blocks, content violations, and cost overages.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Event Type</th>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">Customer ID</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b last:border-0 hover:bg-gray-50"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${eventTypeBadgeClass(log.eventType)}`}
                    >
                      {formatEventType(log.eventType)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${severityBadgeClass(log.severity)}`}
                    >
                      {log.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {log.customerId ?? '--'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        setExpandedLogId(
                          expandedLogId === log.id ? null : log.id,
                        )
                      }
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      {expandedLogId === log.id ? 'Hide' : 'View'}
                    </button>
                    {expandedLogId === log.id && (
                      <pre className="mt-2 max-h-48 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * PAGE_SIZE + 1}
            {' '}-{' '}
            {Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded border px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded border px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

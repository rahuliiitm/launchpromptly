'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import { PageLoader } from '@/components/spinner';
import { ResultCard, ActionBadge, SecuritySummaryBanner, InjectionGauge, JailbreakGauge, PIIDetailTable, ContentViolationTable, UnicodeThreatsTable, SecretDetectionTable } from '@/components/security-viz';

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
  { label: 'Jailbreak Blocked', value: 'jailbreak_blocked' },
  { label: 'Jailbreak Warned', value: 'jailbreak_warned' },
  { label: 'Unicode Threat', value: 'unicode_threat' },
  { label: 'Secret Detected', value: 'secret_detected' },
  { label: 'Topic Violation', value: 'topic_violation' },
  { label: 'Output Safety', value: 'output_safety' },
  { label: 'Prompt Leakage', value: 'prompt_leakage' },
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
    case 'jailbreak_blocked':
      return 'bg-purple-50 text-purple-700';
    case 'jailbreak_warned':
      return 'bg-purple-50 text-purple-700';
    case 'unicode_threat':
      return 'bg-teal-50 text-teal-700';
    case 'secret_detected':
      return 'bg-pink-50 text-pink-700';
    case 'topic_violation':
      return 'bg-yellow-50 text-yellow-700';
    case 'output_safety':
      return 'bg-red-50 text-red-700';
    case 'prompt_leakage':
      return 'bg-red-50 text-red-700';
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
  const [selectedEventDetail, setSelectedEventDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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

  async function fetchEventDetail(eventId: string) {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;
    setDetailLoading(true);
    try {
      const data = await apiFetch<any>(
        `/v1/events/${projectId}/${eventId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSelectedEventDetail(data);
    } catch {
      setSelectedEventDetail({ error: true });
    } finally {
      setDetailLoading(false);
    }
  }

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
                    {log.eventId ? (
                      <button
                        onClick={() => fetchEventDetail(log.eventId!)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        View
                      </button>
                    ) : (
                      <>
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
                      </>
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

      {/* Loading spinner for event detail */}
      {detailLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl bg-white p-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
          </div>
        </div>
      )}

      {/* Event detail modal */}
      {selectedEventDetail && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16">
          <div className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-2xl">
            {/* Close button */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Event Detail</h2>
              <button onClick={() => setSelectedEventDetail(null)} className="rounded-lg p-1 hover:bg-gray-100">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {selectedEventDetail.error ? (
              <div className="text-center py-8">
                <svg className="mx-auto h-10 w-10 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="mt-3 font-medium text-red-600">Failed to load event details</p>
                <p className="mt-1 text-sm text-gray-500">The event may no longer exist or you may not have access.</p>
              </div>
            ) : (
              <>
                {/* Event metadata bar */}
                <div className="mb-6 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-4 text-sm sm:grid-cols-4">
                  <div><span className="text-gray-500">Model</span><p className="font-medium text-gray-900">{selectedEventDetail.model}</p></div>
                  <div><span className="text-gray-500">Latency</span><p className="font-medium text-gray-900">{selectedEventDetail.latencyMs}ms</p></div>
                  <div><span className="text-gray-500">Cost</span><p className="font-medium text-gray-900">${selectedEventDetail.costUsd?.toFixed(4)}</p></div>
                  <div><span className="text-gray-500">Time</span><p className="font-medium text-gray-900">{new Date(selectedEventDetail.createdAt).toLocaleString()}</p></div>
                </div>

                {/* Security summary */}
                {(() => {
                  const sm = selectedEventDetail.securityMetadata as any;
                  const piiData = sm?.piiDetections;
                  const injData = sm?.injectionRisk;
                  const contentData = sm?.contentViolations;
                  const jailData = sm?.jailbreakRisk;
                  const unicodeData = sm?.unicodeThreats;
                  const secretData = sm?.secretDetections;
                  const topicData = sm?.topicViolation;
                  const outputData = sm?.outputSafety;
                  const leakData = sm?.promptLeakage;
                  const inputDetails = piiData?.inputDetails ?? [];
                  const outputDetails = piiData?.outputDetails ?? [];
                  const inputViolations = contentData?.inputViolations ?? [];
                  const outputViolations = contentData?.outputViolations ?? [];
                  const allViolations = [...inputViolations, ...outputViolations];
                  const totalFindings =
                    (inputDetails.length + outputDetails.length) +
                    (injData && injData.score > 0 ? 1 : 0) +
                    allViolations.length +
                    (jailData && jailData.score > 0 ? 1 : 0) +
                    (unicodeData?.found ? unicodeData.threatCount : 0) +
                    (secretData ? (secretData.inputCount ?? 0) + (secretData.outputCount ?? 0) : 0) +
                    (topicData ? 1 : 0) +
                    (outputData?.threatCount ?? 0) +
                    (leakData?.leaked ? 1 : 0);

                  return (
                    <div className="space-y-4">
                      <SecuritySummaryBanner count={totalFindings} />

                      {/* PII Section */}
                      {(selectedEventDetail.piiDetectionCount ?? 0) > 0 && (
                        <ResultCard
                          title="PII Detection"
                          count={selectedEventDetail.piiDetectionCount ?? 0}
                          color="blue"
                          icon={
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                            </svg>
                          }
                        >
                          {inputDetails.length > 0 || outputDetails.length > 0 ? (
                            <>
                              {selectedEventDetail.promptText && inputDetails.length > 0 && (
                                <div className="mb-3">
                                  <p className="text-xs font-medium text-gray-500 mb-1">Input</p>
                                  <PIIDetailTable detections={inputDetails} text={selectedEventDetail.promptText} />
                                </div>
                              )}
                              {selectedEventDetail.responseText && outputDetails.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-gray-500 mb-1">Output</p>
                                  <PIIDetailTable detections={outputDetails} text={selectedEventDetail.responseText} />
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-sm text-gray-500">
                              <p>{selectedEventDetail.piiDetectionCount} PII detection(s) found</p>
                              <p className="text-xs text-gray-400 mt-1">Types: {(selectedEventDetail.piiTypes ?? []).join(', ')}</p>
                              <p className="text-xs text-gray-400">Detail not available for events before this version</p>
                            </div>
                          )}
                        </ResultCard>
                      )}

                      {/* Injection Section */}
                      {injData && (
                        <ResultCard
                          title="Injection Detection"
                          count={injData.triggered?.length ?? 0}
                          color="orange"
                          icon={
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                            </svg>
                          }
                        >
                          <InjectionGauge score={injData.score} action={injData.action} triggered={injData.triggered ?? []} />
                        </ResultCard>
                      )}

                      {/* Content Section */}
                      {allViolations.length > 0 && (
                        <ResultCard
                          title="Content Filter"
                          count={allViolations.length}
                          color="red"
                          icon={
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l1.664 1.664M21 21l-1.5-1.5m-5.533-1.8a3.75 3.75 0 01-5.3-5.3m14.336-1.4A9 9 0 013.997 7.997M12 12L3 21m9-9l9-9" />
                            </svg>
                          }
                        >
                          <ContentViolationTable violations={allViolations} />
                        </ResultCard>
                      )}

                      {/* Jailbreak Section */}
                      {jailData && (
                        <ResultCard
                          title="Jailbreak Detection"
                          count={jailData.triggered?.length ?? 0}
                          color="purple"
                          icon={
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                          }
                        >
                          <JailbreakGauge score={jailData.score} action={jailData.action} triggered={jailData.triggered ?? []} />
                        </ResultCard>
                      )}

                      {/* Unicode Section */}
                      {unicodeData?.found && (
                        <ResultCard
                          title="Unicode Scanner"
                          count={unicodeData.threatCount ?? 0}
                          color="teal"
                          icon={
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
                            </svg>
                          }
                        >
                          <UnicodeThreatsTable threats={(unicodeData.threatTypes ?? []).map((t: string) => ({ category: t, severity: unicodeData.action ?? 'warn' }))} />
                        </ResultCard>
                      )}

                      {/* Secret Detection Section */}
                      {secretData && ((secretData.inputCount ?? 0) + (secretData.outputCount ?? 0)) > 0 && (
                        <ResultCard
                          title="Secret Detection"
                          count={(secretData.inputCount ?? 0) + (secretData.outputCount ?? 0)}
                          color="pink"
                          icon={
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                            </svg>
                          }
                        >
                          <SecretDetectionTable secrets={(secretData.types ?? []).map((t: string) => ({ type: t }))} />
                        </ResultCard>
                      )}

                      {/* Topic Violation Section */}
                      {topicData && (
                        <ResultCard
                          title="Topic Guard"
                          count={1}
                          color="orange"
                          icon={
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                          }
                        >
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">Type:</span>
                              <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">{topicData.type}</span>
                            </div>
                            {topicData.topic && (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500">Topic:</span>
                                <span className="font-medium text-gray-900">{topicData.topic}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-gray-500">Matched keywords:</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {(topicData.matchedKeywords ?? []).map((kw: string) => (
                                  <span key={kw} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{kw}</span>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">Score:</span>
                              <span className="font-bold">{topicData.score?.toFixed(2)}</span>
                            </div>
                          </div>
                        </ResultCard>
                      )}

                      {/* Output Safety Section */}
                      {outputData && (outputData.threatCount ?? 0) > 0 && (
                        <ResultCard
                          title="Output Safety"
                          count={outputData.threatCount ?? 0}
                          color="red"
                          icon={
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                            </svg>
                          }
                        >
                          <ContentViolationTable violations={outputData.threats ?? []} />
                        </ResultCard>
                      )}

                      {/* Prompt Leakage Section */}
                      {leakData?.leaked && (
                        <ResultCard
                          title="Prompt Leakage"
                          count={1}
                          color="red"
                          icon={
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                            </svg>
                          }
                        >
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">Similarity:</span>
                              <span className="font-bold">{(leakData.similarity * 100).toFixed(1)}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">Meta-response detected:</span>
                              <span className={`rounded px-2 py-0.5 text-xs font-medium ${leakData.metaResponseDetected ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {leakData.metaResponseDetected ? 'Yes' : 'No'}
                              </span>
                            </div>
                          </div>
                        </ResultCard>
                      )}

                      {/* Prompt/Response text preview (if no security findings but text is available) */}
                      {totalFindings === 0 && (selectedEventDetail.promptText || selectedEventDetail.responseText) && (
                        <div className="rounded-lg border bg-white p-4">
                          {selectedEventDetail.promptText && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-gray-500 mb-1">Input</p>
                              <p className="text-sm text-gray-700 bg-gray-50 rounded p-3">{selectedEventDetail.promptText}</p>
                            </div>
                          )}
                          {selectedEventDetail.responseText && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">Output</p>
                              <p className="text-sm text-gray-700 bg-gray-50 rounded p-3">{selectedEventDetail.responseText}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

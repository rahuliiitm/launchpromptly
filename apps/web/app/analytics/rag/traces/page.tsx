'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import type { RagTraceListItem } from '@aiecon/types';

export default function RagTracesPage() {
  const searchParams = useSearchParams();
  const pipelineFilter = searchParams.get('pipeline') ?? '';

  const [traces, setTraces] = useState<RagTraceListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [days, setDays] = useState(7);
  const limit = 20;

  useEffect(() => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const params = new URLSearchParams({
      days: String(days),
      page: String(page),
      limit: String(limit),
    });
    if (pipelineFilter) params.set('pipeline', pipelineFilter);

    apiFetch<{ traces: RagTraceListItem[]; total: number }>(
      `/analytics/${projectId}/rag/traces?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
      .then((res) => {
        setTraces(res.traces);
        setTotal(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, days, pipelineFilter]);

  const totalPages = Math.ceil(total / limit);

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">RAG Traces</h1>
          {pipelineFilter && (
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                {pipelineFilter}
              </span>
              <Link href="/analytics/rag/traces" className="text-xs text-gray-500 hover:text-gray-700">
                Clear filter
              </Link>
            </div>
          )}
        </div>
        <div className="flex gap-1 rounded border bg-white p-1">
          {[1, 7, 30].map((d) => (
            <button
              key={d}
              onClick={() => { setDays(d); setPage(1); }}
              className={`rounded px-3 py-1 text-xs font-medium ${
                days === d ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {traces.length === 0 ? (
        <div className="mt-8 rounded-lg border bg-white p-8 text-center">
          <p className="text-sm text-gray-500">No RAG traces found for this period.</p>
        </div>
      ) : (
        <>
          <div className="mt-4 text-sm text-gray-500">
            {total.toLocaleString()} traces total
          </div>

          <div className="mt-3 space-y-2">
            {traces.map((trace) => (
              <Link
                key={trace.id}
                href={`/analytics/rag/traces/${trace.id}`}
                className="block rounded-lg border bg-white p-4 transition hover:border-blue-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {trace.ragPipelineId && (
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {trace.ragPipelineId}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(trace.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {trace.ragQuery && (
                      <p className="mt-1 truncate text-sm text-gray-700">
                        {trace.ragQuery}
                      </p>
                    )}
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-4 text-xs text-gray-500">
                    {trace.ragRetrievalMs != null && (
                      <span>{trace.ragRetrievalMs}ms retrieval</span>
                    )}
                    {trace.ragChunkCount != null && (
                      <span>{trace.ragChunkCount} chunks</span>
                    )}
                    <span>{trace.latencyMs}ms total</span>
                    <span>${trace.costUsd.toFixed(4)}</span>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                      {trace.model}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded border px-3 py-1 text-sm disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded border px-3 py-1 text-sm disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

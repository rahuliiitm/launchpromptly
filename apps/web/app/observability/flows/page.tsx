'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import type { FlowListItem } from '@aiecon/types';

function ScoreDot({ score }: { score: number | null }) {
  if (score === null) return null;
  const color =
    score > 0.8 ? 'bg-green-500' : score >= 0.5 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      <span className="text-xs">{score.toFixed(2)}</span>
    </span>
  );
}

export default function FlowsPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-400">Loading...</div>}>
      <FlowsContent />
    </Suspense>
  );
}

function FlowsContent() {
  const searchParams = useSearchParams();
  const pipelineFilter = searchParams.get('pipeline') ?? '';

  const [flows, setFlows] = useState<FlowListItem[]>([]);
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

    apiFetch<{ flows: FlowListItem[]; total: number }>(
      `/analytics/${projectId}/rag/flows?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
      .then((res) => {
        setFlows(res.flows);
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
          <h1 className="text-2xl font-bold">Flows</h1>
          <p className="mt-1 text-sm text-gray-500">
            Each flow groups all LLM calls for a single user query
          </p>
          {pipelineFilter && (
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                {pipelineFilter}
              </span>
              <Link href="/observability/flows" className="text-xs text-gray-500 hover:text-gray-700">
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

      {flows.length === 0 ? (
        <div className="mt-8 rounded-lg border bg-white p-8 text-center">
          <p className="text-sm text-gray-500">No flows found for this period.</p>
        </div>
      ) : (
        <>
          <div className="mt-4 text-sm text-gray-500">
            {total.toLocaleString()} flows total
          </div>

          <div className="mt-3 space-y-2">
            {flows.map((flow) => {
              const hasEval =
                flow.faithfulnessScore !== null ||
                flow.relevanceScore !== null ||
                flow.contextRelevanceScore !== null;
              return (
                <Link
                  key={flow.traceId}
                  href={`/observability/flows/${flow.traceId}`}
                  className="block rounded-lg border bg-white p-4 transition hover:border-blue-300"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {flow.ragPipelineId && (
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {flow.ragPipelineId}
                          </span>
                        )}
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          {flow.spanCount} span{flow.spanCount !== 1 ? 's' : ''}
                        </span>
                        {flow.spanNames.length > 0 && (
                          <div className="flex gap-1">
                            {flow.spanNames.map((name) => (
                              <span
                                key={name}
                                className="rounded bg-purple-50 px-1.5 py-0.5 text-xs text-purple-600"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                        <span className="text-xs text-gray-400">
                          {new Date(flow.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {flow.ragQuery && (
                        <p className="mt-1 truncate text-sm text-gray-700">
                          {flow.ragQuery}
                        </p>
                      )}
                      {flow.responsePreview && (
                        <p className="mt-0.5 truncate text-xs text-gray-400">
                          {flow.responsePreview}
                        </p>
                      )}
                      {hasEval && (
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                          {flow.faithfulnessScore !== null && (
                            <span className="flex items-center gap-1">
                              Faith: <ScoreDot score={flow.faithfulnessScore} />
                            </span>
                          )}
                          {flow.relevanceScore !== null && (
                            <span className="flex items-center gap-1">
                              Answer: <ScoreDot score={flow.relevanceScore} />
                            </span>
                          )}
                          {flow.contextRelevanceScore !== null && (
                            <span className="flex items-center gap-1">
                              Context: <ScoreDot score={flow.contextRelevanceScore} />
                            </span>
                          )}
                        </div>
                      )}
                      {!hasEval && (
                        <div className="mt-2 text-xs text-gray-300">Not evaluated</div>
                      )}
                    </div>
                    <div className="ml-4 flex shrink-0 items-center gap-4 text-xs text-gray-500">
                      <span>{flow.totalLatencyMs}ms</span>
                      <span>${flow.totalCostUsd.toFixed(4)}</span>
                      <div className="flex gap-1">
                        {flow.models.map((m) => (
                          <span key={m} className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

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

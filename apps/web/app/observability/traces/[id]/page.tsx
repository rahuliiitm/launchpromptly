'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import type { RagTraceDetail, RagEvaluationResult } from '@aiecon/types';

function ScoreBadge({ score, size = 'md' }: { score: number | null; size?: 'sm' | 'md' | 'lg' }) {
  if (score === null) return <span className="text-gray-300">—</span>;
  const color =
    score > 0.8
      ? 'bg-green-100 text-green-700'
      : score >= 0.5
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-red-100 text-red-700';
  const sizeClass = size === 'lg' ? 'text-2xl px-3 py-1' : size === 'md' ? 'text-sm px-2 py-0.5' : 'text-xs px-2 py-0.5';
  return (
    <span className={`inline-block rounded font-medium ${color} ${sizeClass}`}>
      {score.toFixed(2)}
    </span>
  );
}

export default function TraceDetailPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [trace, setTrace] = useState<RagTraceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState('');

  useEffect(() => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) {
      setLoading(false);
      return;
    }

    apiFetch<RagTraceDetail>(`/analytics/${projectId}/rag/traces/${eventId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(setTrace)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [eventId]);

  const handleEvaluate = useCallback(async () => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    setEvaluating(true);
    setEvalError('');
    try {
      const result = await apiFetch<RagEvaluationResult>(
        `/analytics/${projectId}/rag/traces/${eventId}/evaluate`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
      );
      setTrace((prev) => prev ? { ...prev, evaluation: result } : prev);
    } catch (err) {
      setEvalError((err as Error).message);
    } finally {
      setEvaluating(false);
    }
  }, [eventId]);

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  if (error || !trace) {
    return (
      <div>
        <Link href="/observability/traces" className="text-sm text-blue-600 hover:text-blue-800">
          &larr; Back to traces
        </Link>
        <div className="mt-4 rounded-lg border bg-white p-8 text-center">
          <p className="text-sm text-gray-500">{error || 'Trace not found.'}</p>
        </div>
      </div>
    );
  }

  const evaluation = trace.evaluation;

  return (
    <div>
      <div className="flex items-center gap-4">
        <Link href="/observability/traces" className="text-sm text-blue-600 hover:text-blue-800">
          &larr; Back to traces
        </Link>
        {(trace as RagTraceDetail & { traceId?: string }).traceId && (
          <Link
            href={`/observability/flows/${(trace as RagTraceDetail & { traceId?: string }).traceId}`}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            &larr; Back to flow
          </Link>
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Trace Detail</h1>
          {trace.ragPipelineId && (
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              {trace.ragPipelineId}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-400">
          {new Date(trace.createdAt).toLocaleString()} &middot; {trace.provider}/{trace.model}
        </p>
      </div>

      {/* Evaluation Section */}
      <div className="mt-6 rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Quality Evaluation
          </h2>
          {!evaluation && (
            <button
              onClick={handleEvaluate}
              disabled={evaluating}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {evaluating ? 'Evaluating...' : 'Run Evaluation'}
            </button>
          )}
          {evaluation && (
            <span className="text-xs text-gray-400">
              via {evaluation.evaluationModel} &middot; ${evaluation.evaluationCostUsd.toFixed(4)}
            </span>
          )}
        </div>

        {evalError && <p className="mt-2 text-sm text-red-500">{evalError}</p>}

        {evaluation && evaluation.status === 'error' && (
          <p className="mt-3 text-sm text-red-500">Evaluation failed: {evaluation.error}</p>
        )}

        {evaluation && evaluation.status === 'completed' && (
          <div className="mt-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <ScoreBadge score={evaluation.faithfulnessScore} size="lg" />
                <div className="mt-1 text-xs text-gray-500">Faithfulness</div>
              </div>
              <div className="text-center">
                <ScoreBadge score={evaluation.relevanceScore} size="lg" />
                <div className="mt-1 text-xs text-gray-500">Answer Relevance</div>
              </div>
              <div className="text-center">
                <ScoreBadge score={evaluation.contextRelevanceScore} size="lg" />
                <div className="mt-1 text-xs text-gray-500">Context Relevance</div>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {evaluation.faithfulnessReasoning && (
                <div className="rounded bg-gray-50 p-3">
                  <div className="text-xs font-medium text-gray-500">Faithfulness</div>
                  <p className="mt-1 text-sm text-gray-700">{evaluation.faithfulnessReasoning}</p>
                </div>
              )}
              {evaluation.relevanceReasoning && (
                <div className="rounded bg-gray-50 p-3">
                  <div className="text-xs font-medium text-gray-500">Answer Relevance</div>
                  <p className="mt-1 text-sm text-gray-700">{evaluation.relevanceReasoning}</p>
                </div>
              )}
              {evaluation.contextRelevanceReasoning && (
                <div className="rounded bg-gray-50 p-3">
                  <div className="text-xs font-medium text-gray-500">Context Relevance</div>
                  <p className="mt-1 text-sm text-gray-700">{evaluation.contextRelevanceReasoning}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {!evaluation && !evaluating && (
          <p className="mt-3 text-sm text-gray-400">
            Click &ldquo;Run Evaluation&rdquo; to score this trace using LLM-as-judge.
            Requires a configured provider key.
          </p>
        )}
      </div>

      {trace.ragQuery && (
        <div className="mt-6 rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">User Query</h2>
          <p className="mt-2 text-gray-800">{trace.ragQuery}</p>
        </div>
      )}

      {trace.responseText && (
        <div className="mt-4 rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">LLM Response</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{trace.responseText}</p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-5 gap-3">
        <div className="rounded-lg border bg-white p-3 text-center">
          <div className="text-lg font-bold">{trace.ragRetrievalMs ?? '—'}ms</div>
          <div className="text-xs text-gray-500">Retrieval</div>
        </div>
        <div className="rounded-lg border bg-white p-3 text-center">
          <div className="text-lg font-bold">{trace.latencyMs}ms</div>
          <div className="text-xs text-gray-500">Total Latency</div>
        </div>
        <div className="rounded-lg border bg-white p-3 text-center">
          <div className="text-lg font-bold">{trace.ragChunkCount ?? '—'}</div>
          <div className="text-xs text-gray-500">Chunks</div>
        </div>
        <div className="rounded-lg border bg-white p-3 text-center">
          <div className="text-lg font-bold">{trace.totalTokens.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Tokens</div>
        </div>
        <div className="rounded-lg border bg-white p-3 text-center">
          <div className="text-lg font-bold">${trace.costUsd.toFixed(4)}</div>
          <div className="text-xs text-gray-500">Cost</div>
        </div>
      </div>

      {trace.ragChunks && trace.ragChunks.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Retrieved Chunks ({trace.ragChunks.length})
          </h2>
          <div className="mt-3 space-y-3">
            {trace.ragChunks.map((chunk, i) => {
              const chunkEval = evaluation?.chunkRelevanceScores?.find((c) => c.index === i);
              return (
                <div key={i} className="rounded-lg border bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                        {i + 1}
                      </span>
                      <span className="text-xs font-medium text-gray-500">{chunk.source}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {chunkEval && (
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                          chunkEval.relevant ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {chunkEval.relevant ? 'Relevant' : 'Noise'} ({chunkEval.score.toFixed(2)})
                        </span>
                      )}
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                        chunk.score >= 0.8 ? 'bg-green-100 text-green-700'
                          : chunk.score >= 0.5 ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                      }`}>
                        Sim: {chunk.score.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{chunk.content}</p>
                  {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
                    <div className="mt-2 text-xs text-gray-400">
                      {Object.entries(chunk.metadata).map(([k, v]) => (
                        <span key={k} className="mr-3">{k}: {String(v)}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {trace.promptPreview && (
        <div className="mt-6 rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">System Prompt Preview</h2>
          <pre className="mt-2 whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm text-gray-700">
            {trace.promptPreview}
          </pre>
        </div>
      )}

      <div className="mt-6 rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Token Breakdown</h2>
        <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Input:</span>{' '}
            <span className="font-medium">{trace.inputTokens.toLocaleString()}</span>
            {trace.ragContextTokens != null && (
              <span className="text-xs text-gray-400"> ({trace.ragContextTokens} from context)</span>
            )}
          </div>
          <div>
            <span className="text-gray-500">Output:</span>{' '}
            <span className="font-medium">{trace.outputTokens.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-500">Total:</span>{' '}
            <span className="font-medium">{trace.totalTokens.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {(trace.customerId || trace.feature) && (
        <div className="mt-6 rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Metadata</h2>
          <div className="mt-3 flex gap-6 text-sm">
            {trace.customerId && (
              <div>
                <span className="text-gray-500">Customer:</span>{' '}
                <span className="font-medium">{trace.customerId}</span>
              </div>
            )}
            {trace.feature && (
              <div>
                <span className="text-gray-500">Feature:</span>{' '}
                <span className="font-medium">{trace.feature}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

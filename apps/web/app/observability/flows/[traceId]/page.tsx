'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import type { FlowDetail, FlowSpan, RagEvaluationResult } from '@aiecon/types';

function ScoreBadge({ score, size = 'md' }: { score: number | null; size?: 'sm' | 'md' | 'lg' }) {
  if (score === null) return <span className="text-gray-300">&mdash;</span>;
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

function SpanCard({ span, maxLatency }: { span: FlowSpan; maxLatency: number }) {
  const barWidth = maxLatency > 0 ? Math.max(4, (span.latencyMs / maxLatency) * 100) : 0;
  const spanColor: Record<string, string> = {
    rerank: 'bg-amber-500',
    generate: 'bg-blue-500',
    guardrail: 'bg-emerald-500',
  };
  const barColor = span.spanName ? (spanColor[span.spanName] ?? 'bg-gray-400') : 'bg-gray-400';

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {span.spanName && (
            <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
              {span.spanName}
            </span>
          )}
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {span.model}
          </span>
          {span.managedPromptName && (
            <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600">
              {span.managedPromptName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{span.latencyMs}ms</span>
          <span>${span.costUsd.toFixed(4)}</span>
          <span>{span.totalTokens.toLocaleString()} tok</span>
        </div>
      </div>

      {/* Latency bar */}
      <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
        <div
          className={`h-2 rounded-full ${barColor}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {/* Details */}
      <div className="mt-3 space-y-2">
        {span.ragQuery && (
          <div>
            <span className="text-xs font-medium text-gray-500">Query:</span>
            <p className="mt-0.5 text-sm text-gray-700">{span.ragQuery}</p>
          </div>
        )}
        {span.responseText && (
          <div>
            <span className="text-xs font-medium text-gray-500">Response:</span>
            <p className="mt-0.5 line-clamp-3 text-sm text-gray-600">{span.responseText}</p>
          </div>
        )}
        {span.ragChunkCount != null && (
          <div className="flex gap-4 text-xs text-gray-500">
            <span>{span.ragChunkCount} chunks</span>
            {span.ragRetrievalMs != null && <span>{span.ragRetrievalMs}ms retrieval</span>}
            {span.ragContextTokens != null && <span>{span.ragContextTokens} context tokens</span>}
          </div>
        )}
        {span.evaluation && span.evaluation.status === 'completed' && (
          <div className="flex items-center gap-3 pt-1 text-xs">
            <span className="text-gray-500">Scores:</span>
            <span>Faith: <ScoreBadge score={span.evaluation.faithfulnessScore} size="sm" /></span>
            <span>Answer: <ScoreBadge score={span.evaluation.relevanceScore} size="sm" /></span>
            <span>Context: <ScoreBadge score={span.evaluation.contextRelevanceScore} size="sm" /></span>
          </div>
        )}
      </div>

      <div className="mt-2 text-right">
        <Link
          href={`/observability/traces/${span.id}`}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          View full trace &rarr;
        </Link>
      </div>
    </div>
  );
}

export default function FlowDetailPage() {
  const params = useParams();
  const traceId = params.traceId as string;

  const [flow, setFlow] = useState<FlowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) {
      setLoading(false);
      return;
    }

    apiFetch<FlowDetail>(`/analytics/${projectId}/rag/flows/${traceId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(setFlow)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [traceId]);

  const handleEvaluateGenerate = useCallback(async () => {
    if (!flow) return;
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    const generateSpan = flow.spans.find((s) => s.spanName === 'generate') ?? flow.spans.find((s) => s.ragQuery !== null);
    if (!generateSpan) return;

    setEvaluating(true);
    try {
      const result = await apiFetch<RagEvaluationResult>(
        `/analytics/${projectId}/rag/traces/${generateSpan.id}/evaluate`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
      );
      setFlow((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          evaluation: result,
          spans: prev.spans.map((s) =>
            s.id === generateSpan.id ? { ...s, evaluation: result } : s,
          ),
        };
      });
    } catch {
      // ignore
    } finally {
      setEvaluating(false);
    }
  }, [flow]);

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  if (error || !flow) {
    return (
      <div>
        <Link href="/observability/flows" className="text-sm text-blue-600 hover:text-blue-800">
          &larr; Back to flows
        </Link>
        <div className="mt-4 rounded-lg border bg-white p-8 text-center">
          <p className="text-sm text-gray-500">{error || 'Flow not found.'}</p>
        </div>
      </div>
    );
  }

  const maxLatency = Math.max(...flow.spans.map((s) => s.latencyMs));
  const evaluation = flow.evaluation;
  const totalLatencyMs = flow.spans.reduce((sum, s) => sum + s.latencyMs, 0);

  return (
    <div>
      <Link href="/observability/flows" className="text-sm text-blue-600 hover:text-blue-800">
        &larr; Back to flows
      </Link>

      <div className="mt-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Flow Detail</h1>
          {flow.ragPipelineId && (
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              {flow.ragPipelineId}
            </span>
          )}
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {flow.spans.length} span{flow.spans.length !== 1 ? 's' : ''}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-400 font-mono">
          traceId: {flow.traceId}
        </p>
      </div>

      {/* Summary stats */}
      <div className="mt-4 grid grid-cols-4 gap-3">
        <div className="rounded-lg border bg-white p-3 text-center">
          <div className="text-lg font-bold">{totalLatencyMs}ms</div>
          <div className="text-xs text-gray-500">Total Latency</div>
        </div>
        <div className="rounded-lg border bg-white p-3 text-center">
          <div className="text-lg font-bold">${flow.totalCostUsd.toFixed(4)}</div>
          <div className="text-xs text-gray-500">Total Cost</div>
        </div>
        <div className="rounded-lg border bg-white p-3 text-center">
          <div className="text-lg font-bold">{flow.totalTokens.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Total Tokens</div>
        </div>
        <div className="rounded-lg border bg-white p-3 text-center">
          <div className="text-lg font-bold">{flow.spans.length}</div>
          <div className="text-xs text-gray-500">Spans</div>
        </div>
      </div>

      {/* Quality evaluation */}
      <div className="mt-6 rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Flow Quality
          </h2>
          {!evaluation && (
            <button
              onClick={handleEvaluateGenerate}
              disabled={evaluating}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {evaluating ? 'Evaluating...' : 'Run Evaluation'}
            </button>
          )}
        </div>
        {evaluation && evaluation.status === 'completed' ? (
          <div className="mt-3">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <ScoreBadge score={evaluation.faithfulnessScore} size="lg" />
                <div className="mt-1 text-xs text-gray-500">Faithfulness</div>
              </div>
              <div>
                <ScoreBadge score={evaluation.relevanceScore} size="lg" />
                <div className="mt-1 text-xs text-gray-500">Answer Relevance</div>
              </div>
              <div>
                <ScoreBadge score={evaluation.contextRelevanceScore} size="lg" />
                <div className="mt-1 text-xs text-gray-500">Context Relevance</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {evaluation.faithfulnessReasoning && (
                <div className="rounded bg-gray-50 p-3">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium text-gray-500">Faithfulness</div>
                    <ScoreBadge score={evaluation.faithfulnessScore} size="sm" />
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{evaluation.faithfulnessReasoning}</p>
                </div>
              )}
              {evaluation.relevanceReasoning && (
                <div className="rounded bg-gray-50 p-3">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium text-gray-500">Answer Relevance</div>
                    <ScoreBadge score={evaluation.relevanceScore} size="sm" />
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{evaluation.relevanceReasoning}</p>
                </div>
              )}
              {evaluation.contextRelevanceReasoning && (
                <div className="rounded bg-gray-50 p-3">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium text-gray-500">Context Relevance</div>
                    <ScoreBadge score={evaluation.contextRelevanceScore} size="sm" />
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{evaluation.contextRelevanceReasoning}</p>
                </div>
              )}
            </div>

            {evaluation.chunkRelevanceScores && evaluation.chunkRelevanceScores.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-medium text-gray-500">Chunk Relevance</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {evaluation.chunkRelevanceScores.map((chunk) => (
                    <span
                      key={chunk.index}
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        chunk.relevant
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      Chunk {chunk.index + 1}: {chunk.score.toFixed(2)} {chunk.relevant ? '✓' : '✗'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 text-right text-xs text-gray-400">
              Evaluated by {evaluation.evaluationModel} &middot; ${evaluation.evaluationCostUsd.toFixed(4)}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-400">
            Click &ldquo;Run Evaluation&rdquo; to score the generate span of this flow.
          </p>
        )}
      </div>

      {/* Span Timeline */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Span Timeline
        </h2>
        <div className="mt-3 space-y-3">
          {flow.spans.map((span, i) => (
            <div key={span.id} className="flex gap-3">
              {/* Timeline connector */}
              <div className="flex flex-col items-center">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">
                  {i + 1}
                </div>
                {i < flow.spans.length - 1 && (
                  <div className="w-0.5 flex-1 bg-gray-200" />
                )}
              </div>
              <div className="flex-1 pb-3">
                <SpanCard span={span} maxLatency={maxLatency} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cost breakdown table */}
      <div className="mt-6 rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Cost Breakdown
        </h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2 font-medium">Span</th>
              <th className="pb-2 font-medium">Model</th>
              <th className="pb-2 font-medium text-right">Input</th>
              <th className="pb-2 font-medium text-right">Output</th>
              <th className="pb-2 font-medium text-right">Latency</th>
              <th className="pb-2 font-medium text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {flow.spans.map((span) => (
              <tr key={span.id} className="border-b last:border-0">
                <td className="py-2">
                  {span.spanName ? (
                    <span className="rounded bg-purple-50 px-1.5 py-0.5 text-xs text-purple-600">
                      {span.spanName}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">unnamed</span>
                  )}
                </td>
                <td className="py-2 text-xs text-gray-600">{span.model}</td>
                <td className="py-2 text-right text-xs">{span.inputTokens.toLocaleString()}</td>
                <td className="py-2 text-right text-xs">{span.outputTokens.toLocaleString()}</td>
                <td className="py-2 text-right text-xs">{span.latencyMs}ms</td>
                <td className="py-2 text-right text-xs font-medium">${span.costUsd.toFixed(4)}</td>
              </tr>
            ))}
            <tr className="font-medium">
              <td className="pt-2" colSpan={2}>Total</td>
              <td className="pt-2 text-right text-xs">
                {flow.spans.reduce((s, sp) => s + sp.inputTokens, 0).toLocaleString()}
              </td>
              <td className="pt-2 text-right text-xs">
                {flow.spans.reduce((s, sp) => s + sp.outputTokens, 0).toLocaleString()}
              </td>
              <td className="pt-2 text-right text-xs">{totalLatencyMs}ms</td>
              <td className="pt-2 text-right text-xs">${flow.totalCostUsd.toFixed(4)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

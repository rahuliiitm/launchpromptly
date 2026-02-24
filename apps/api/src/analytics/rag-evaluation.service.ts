import { Injectable, BadRequestException } from '@nestjs/common';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderKeyService } from '../provider-key/provider-key.service';
import { ProjectService } from '../project/project.service';
import type { RagEvaluationResult, RagQualityOverview, RagQualityTimeSeriesPoint } from '@aiecon/types';

// Preferred evaluation models — cheap and fast
const OPENAI_EVAL_MODEL = 'gpt-4o-mini';
const ANTHROPIC_EVAL_MODEL = 'claude-3-haiku-20240307';

// ── Evaluation Prompts ──

const FAITHFULNESS_PROMPT = `You are evaluating the faithfulness of an AI-generated answer to its source context.

A faithful answer only makes claims that are directly supported by the provided context. Extrapolations, hallucinations, or unsupported claims reduce the score.

Given:
- Retrieved context chunks
- AI-generated answer

Score the faithfulness from 0.0 to 1.0:
- 1.0: Every claim in the answer is directly supported by the context
- 0.7: Most claims are supported, minor extrapolation
- 0.5: Mix of supported and unsupported claims
- 0.3: Mostly unsupported or hallucinated
- 0.0: The answer contradicts or is completely unsupported by context

Respond ONLY with valid JSON:
{"score": <number>, "reasoning": "<brief explanation>"}`;

const ANSWER_RELEVANCE_PROMPT = `You are evaluating whether an AI-generated answer addresses the user's question.

Given:
- User query
- AI-generated answer

Score from 0.0 to 1.0:
- 1.0: Fully addresses the question with a complete, relevant answer
- 0.7: Addresses the question but misses some aspects
- 0.5: Partially addresses the question
- 0.3: Tangentially related but doesn't answer the question
- 0.0: Does not address the question at all

Respond ONLY with valid JSON:
{"score": <number>, "reasoning": "<brief explanation>"}`;

const CONTEXT_RELEVANCE_PROMPT = `You are evaluating the relevance of retrieved context chunks to a user query.

Given:
- User query
- Retrieved chunks (numbered starting at 0)

Score overall context relevance from 0.0 to 1.0, and score each chunk individually.

- 1.0: All chunks are highly relevant to answering the query
- 0.5: Some chunks are relevant, others are noise
- 0.0: None of the chunks help answer the query

Respond ONLY with valid JSON:
{"score": <number>, "reasoning": "<brief explanation>", "chunkScores": [{"index": <number>, "score": <number>, "relevant": <boolean>}]}`;

interface EvalLLMResult {
  response: string;
  model: string;
  costUsd: number;
}

@Injectable()
export class RagEvaluationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providerKeyService: ProviderKeyService,
    private readonly projectService: ProjectService,
  ) {}

  /**
   * Evaluate a single RAG trace. Runs whichever dimensions are possible
   * based on available data (query, chunks, responseText).
   */
  async evaluateTrace(
    projectId: string,
    userId: string,
    eventId: string,
  ): Promise<RagEvaluationResult> {
    await this.projectService.assertProjectAccess(projectId, userId);

    // Check if already evaluated
    const existing = await this.prisma.ragEvaluation.findUnique({
      where: { eventId },
    });
    if (existing) {
      return this.toResult(existing);
    }

    // Get the event
    const event = await this.prisma.lLMEvent.findFirst({
      where: { id: eventId, projectId },
    });
    if (!event) {
      throw new BadRequestException('Event not found');
    }
    if (!event.ragQuery && !event.ragChunks) {
      throw new BadRequestException('Event has no RAG context to evaluate');
    }

    // Get org's provider keys
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.organizationId) {
      throw new BadRequestException('No organization found');
    }
    const orgId = user.organizationId;

    // Build evaluation data
    const query = event.ragQuery;
    const chunks = event.ragChunks as Array<{ content: string; source: string; score: number }> | null;
    const responseText = event.responseText;

    let faithfulnessScore: number | null = null;
    let faithfulnessReasoning: string | null = null;
    let relevanceScore: number | null = null;
    let relevanceReasoning: string | null = null;
    let contextRelevanceScore: number | null = null;
    let contextRelevanceReasoning: string | null = null;
    let chunkRelevanceScores: Array<{ index: number; score: number; relevant: boolean }> | null = null;
    let totalCost = 0;
    let evalModel = '';
    let evalError: string | null = null;

    try {
      // Run evaluations in parallel where possible
      const promises: Array<Promise<void>> = [];

      // Context Relevance: needs query + chunks
      if (query && chunks && chunks.length > 0) {
        promises.push(
          this.evaluateContextRelevance(orgId, query, chunks).then((r) => {
            contextRelevanceScore = r.score;
            contextRelevanceReasoning = r.reasoning;
            chunkRelevanceScores = r.chunkScores;
            totalCost += r.costUsd;
            evalModel = r.model;
          }),
        );
      }

      // Answer Relevance: needs query + response
      if (query && responseText) {
        promises.push(
          this.evaluateAnswerRelevance(orgId, query, responseText).then((r) => {
            relevanceScore = r.score;
            relevanceReasoning = r.reasoning;
            totalCost += r.costUsd;
            evalModel = r.model;
          }),
        );
      }

      // Faithfulness: needs chunks + response
      if (chunks && chunks.length > 0 && responseText) {
        promises.push(
          this.evaluateFaithfulness(orgId, chunks, responseText).then((r) => {
            faithfulnessScore = r.score;
            faithfulnessReasoning = r.reasoning;
            totalCost += r.costUsd;
            evalModel = r.model;
          }),
        );
      }

      if (promises.length === 0) {
        throw new Error('Not enough data to evaluate: need query+chunks, query+response, or chunks+response');
      }

      await Promise.all(promises);
    } catch (err) {
      evalError = (err as Error).message;
    }

    // Store results
    const evaluation = await this.prisma.ragEvaluation.create({
      data: {
        eventId,
        faithfulnessScore,
        faithfulnessReasoning,
        relevanceScore,
        relevanceReasoning,
        contextRelevanceScore,
        contextRelevanceReasoning,
        chunkRelevanceScores: chunkRelevanceScores ?? undefined,
        evaluationModel: evalModel || 'none',
        evaluationCostUsd: totalCost,
        status: evalError ? 'error' : 'completed',
        error: evalError,
      },
    });

    return this.toResult(evaluation);
  }

  /**
   * Batch evaluate recent unevaluated RAG traces.
   */
  async evaluateBatch(
    projectId: string,
    userId: string,
    limit = 20,
  ): Promise<{ evaluated: number; errors: number }> {
    await this.projectService.assertProjectAccess(projectId, userId);

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const unevaluated = await this.prisma.lLMEvent.findMany({
      where: {
        projectId,
        createdAt: { gte: since },
        ragQuery: { not: null },
        ragEvaluation: null,
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    let evaluated = 0;
    let errors = 0;

    for (const event of unevaluated) {
      try {
        await this.evaluateTrace(projectId, userId, event.id);
        evaluated++;
      } catch {
        errors++;
      }
    }

    return { evaluated, errors };
  }

  /**
   * Get aggregate quality metrics for the quality dashboard.
   */
  async getQualityOverview(
    projectId: string,
    userId: string,
    days = 30,
  ): Promise<RagQualityOverview> {
    await this.projectService.assertProjectAccess(projectId, userId);

    const since = new Date();
    since.setDate(since.getDate() - days);

    // Count evaluated and unevaluated
    const [totalEvaluated, totalUnevaluated] = await Promise.all([
      this.prisma.ragEvaluation.count({
        where: {
          event: { projectId, createdAt: { gte: since } },
          status: 'completed',
        },
      }),
      this.prisma.lLMEvent.count({
        where: {
          projectId,
          createdAt: { gte: since },
          ragQuery: { not: null },
          ragEvaluation: null,
        },
      }),
    ]);

    // Aggregate scores
    const agg = await this.prisma.ragEvaluation.aggregate({
      where: {
        event: { projectId, createdAt: { gte: since } },
        status: 'completed',
      },
      _avg: {
        faithfulnessScore: true,
        relevanceScore: true,
        contextRelevanceScore: true,
      },
    });

    // Score distribution (based on average of available scores per evaluation)
    const evaluations = await this.prisma.ragEvaluation.findMany({
      where: {
        event: { projectId, createdAt: { gte: since } },
        status: 'completed',
      },
      select: {
        faithfulnessScore: true,
        relevanceScore: true,
        contextRelevanceScore: true,
      },
    });

    let good = 0;
    let fair = 0;
    let poor = 0;
    for (const e of evaluations) {
      const scores = [e.faithfulnessScore, e.relevanceScore, e.contextRelevanceScore].filter(
        (s): s is number => s !== null,
      );
      if (scores.length === 0) continue;
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avg > 0.8) good++;
      else if (avg >= 0.5) fair++;
      else poor++;
    }

    // Pipeline breakdown
    const pipelineData = await this.prisma.$queryRaw<
      Array<{
        ragPipelineId: string;
        count: bigint;
        avgFaith: number | null;
        avgRel: number | null;
        avgCtx: number | null;
      }>
    >`
      SELECT
        e."ragPipelineId",
        COUNT(*)::bigint AS count,
        AVG(r."faithfulnessScore") AS "avgFaith",
        AVG(r."relevanceScore") AS "avgRel",
        AVG(r."contextRelevanceScore") AS "avgCtx"
      FROM "RagEvaluation" r
      JOIN "LLMEvent" e ON e.id = r."eventId"
      WHERE e."projectId" = ${projectId}
        AND e."createdAt" >= ${since}
        AND r.status = 'completed'
        AND e."ragPipelineId" IS NOT NULL
      GROUP BY e."ragPipelineId"
      ORDER BY count DESC
    `;

    return {
      totalEvaluated,
      totalUnevaluated,
      avgFaithfulness: agg._avg.faithfulnessScore
        ? Math.round(agg._avg.faithfulnessScore * 100) / 100
        : null,
      avgRelevance: agg._avg.relevanceScore
        ? Math.round(agg._avg.relevanceScore * 100) / 100
        : null,
      avgContextRelevance: agg._avg.contextRelevanceScore
        ? Math.round(agg._avg.contextRelevanceScore * 100) / 100
        : null,
      periodDays: days,
      pipelineBreakdown: pipelineData.map((p) => ({
        pipelineId: p.ragPipelineId,
        evaluatedCount: Number(p.count),
        avgFaithfulness: p.avgFaith ? Math.round(p.avgFaith * 100) / 100 : null,
        avgRelevance: p.avgRel ? Math.round(p.avgRel * 100) / 100 : null,
        avgContextRelevance: p.avgCtx ? Math.round(p.avgCtx * 100) / 100 : null,
      })),
      scoreDistribution: { good, fair, poor },
    };
  }

  /**
   * Quality scores over time for the trend chart.
   */
  async getQualityTimeSeries(
    projectId: string,
    userId: string,
    days = 30,
  ): Promise<RagQualityTimeSeriesPoint[]> {
    await this.projectService.assertProjectAccess(projectId, userId);

    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await this.prisma.$queryRaw<
      Array<{
        date: Date;
        count: bigint;
        avgFaith: number | null;
        avgRel: number | null;
        avgCtx: number | null;
      }>
    >`
      SELECT
        DATE_TRUNC('day', e."createdAt") AS date,
        COUNT(*)::bigint AS count,
        AVG(r."faithfulnessScore") AS "avgFaith",
        AVG(r."relevanceScore") AS "avgRel",
        AVG(r."contextRelevanceScore") AS "avgCtx"
      FROM "RagEvaluation" r
      JOIN "LLMEvent" e ON e.id = r."eventId"
      WHERE e."projectId" = ${projectId}
        AND e."createdAt" >= ${since}
        AND r.status = 'completed'
      GROUP BY DATE_TRUNC('day', e."createdAt")
      ORDER BY date ASC
    `;

    return rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      evaluatedCount: Number(r.count),
      avgFaithfulness: r.avgFaith ? Math.round(r.avgFaith * 100) / 100 : null,
      avgRelevance: r.avgRel ? Math.round(r.avgRel * 100) / 100 : null,
      avgContextRelevance: r.avgCtx ? Math.round(r.avgCtx * 100) / 100 : null,
    }));
  }

  // ── Private: LLM Evaluation Calls ──

  private async evaluateContextRelevance(
    orgId: string,
    query: string,
    chunks: Array<{ content: string; source: string; score: number }>,
  ): Promise<{
    score: number;
    reasoning: string;
    chunkScores: Array<{ index: number; score: number; relevant: boolean }>;
    model: string;
    costUsd: number;
  }> {
    const chunksText = chunks
      .map((c, i) => `[Chunk ${i}] (source: ${c.source})\n${c.content}`)
      .join('\n\n');

    const userMessage = `User Query: ${query}\n\nRetrieved Chunks:\n${chunksText}`;
    const result = await this.callEvalLLM(orgId, CONTEXT_RELEVANCE_PROMPT, userMessage);
    const parsed = JSON.parse(result.response);

    return {
      score: parsed.score,
      reasoning: parsed.reasoning,
      chunkScores: parsed.chunkScores ?? [],
      model: result.model,
      costUsd: result.costUsd,
    };
  }

  private async evaluateAnswerRelevance(
    orgId: string,
    query: string,
    answer: string,
  ): Promise<{ score: number; reasoning: string; model: string; costUsd: number }> {
    const userMessage = `User Query: ${query}\n\nAI-Generated Answer:\n${answer}`;
    const result = await this.callEvalLLM(orgId, ANSWER_RELEVANCE_PROMPT, userMessage);
    const parsed = JSON.parse(result.response);

    return {
      score: parsed.score,
      reasoning: parsed.reasoning,
      model: result.model,
      costUsd: result.costUsd,
    };
  }

  private async evaluateFaithfulness(
    orgId: string,
    chunks: Array<{ content: string; source: string; score: number }>,
    answer: string,
  ): Promise<{ score: number; reasoning: string; model: string; costUsd: number }> {
    const chunksText = chunks
      .map((c, i) => `[Chunk ${i}] (source: ${c.source})\n${c.content}`)
      .join('\n\n');

    const userMessage = `Retrieved Context:\n${chunksText}\n\nAI-Generated Answer:\n${answer}`;
    const result = await this.callEvalLLM(orgId, FAITHFULNESS_PROMPT, userMessage);
    const parsed = JSON.parse(result.response);

    return {
      score: parsed.score,
      reasoning: parsed.reasoning,
      model: result.model,
      costUsd: result.costUsd,
    };
  }

  /**
   * Try OpenAI first (gpt-4o-mini), fall back to Anthropic (claude-3-haiku).
   */
  private async callEvalLLM(
    orgId: string,
    systemPrompt: string,
    userMessage: string,
  ): Promise<EvalLLMResult> {
    // Try OpenAI first
    const openaiKey = await this.providerKeyService.getDecryptedKey(orgId, 'openai');
    if (openaiKey) {
      return this.callOpenAIEval(openaiKey, systemPrompt, userMessage);
    }

    // Fall back to Anthropic
    const anthropicKey = await this.providerKeyService.getDecryptedKey(orgId, 'anthropic');
    if (anthropicKey) {
      return this.callAnthropicEval(anthropicKey, systemPrompt, userMessage);
    }

    throw new BadRequestException(
      'No provider keys configured. Add an OpenAI or Anthropic key in Settings > LLM Providers to enable evaluation.',
    );
  }

  private async callOpenAIEval(
    apiKey: string,
    systemPrompt: string,
    userMessage: string,
  ): Promise<EvalLLMResult> {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: OPENAI_EVAL_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });

    const inputTokens = completion.usage?.prompt_tokens ?? 0;
    const outputTokens = completion.usage?.completion_tokens ?? 0;
    // gpt-4o-mini: $0.15/1M input, $0.60/1M output
    const costUsd = (inputTokens * 0.15 + outputTokens * 0.6) / 1_000_000;

    return {
      response: completion.choices[0]?.message?.content ?? '{}',
      model: OPENAI_EVAL_MODEL,
      costUsd,
    };
  }

  private async callAnthropicEval(
    apiKey: string,
    systemPrompt: string,
    userMessage: string,
  ): Promise<EvalLLMResult> {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: ANTHROPIC_EVAL_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const responseText = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const inputTokens = message.usage.input_tokens;
    const outputTokens = message.usage.output_tokens;
    // claude-3-haiku: $0.25/1M input, $1.25/1M output
    const costUsd = (inputTokens * 0.25 + outputTokens * 1.25) / 1_000_000;

    return {
      response: responseText,
      model: ANTHROPIC_EVAL_MODEL,
      costUsd,
    };
  }

  private toResult(evaluation: {
    id: string;
    eventId: string;
    faithfulnessScore: number | null;
    faithfulnessReasoning: string | null;
    relevanceScore: number | null;
    relevanceReasoning: string | null;
    contextRelevanceScore: number | null;
    contextRelevanceReasoning: string | null;
    chunkRelevanceScores: unknown;
    evaluationModel: string;
    evaluationCostUsd: number;
    status: string;
    error: string | null;
    createdAt: Date;
  }): RagEvaluationResult {
    return {
      id: evaluation.id,
      eventId: evaluation.eventId,
      faithfulnessScore: evaluation.faithfulnessScore,
      faithfulnessReasoning: evaluation.faithfulnessReasoning,
      relevanceScore: evaluation.relevanceScore,
      relevanceReasoning: evaluation.relevanceReasoning,
      contextRelevanceScore: evaluation.contextRelevanceScore,
      contextRelevanceReasoning: evaluation.contextRelevanceReasoning,
      chunkRelevanceScores: evaluation.chunkRelevanceScores as RagEvaluationResult['chunkRelevanceScores'],
      evaluationModel: evaluation.evaluationModel,
      evaluationCostUsd: evaluation.evaluationCostUsd,
      status: evaluation.status,
      error: evaluation.error,
      createdAt: evaluation.createdAt.toISOString(),
    };
  }
}

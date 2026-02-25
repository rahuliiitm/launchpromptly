import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import { TeamService } from '../team/team.service';
import type { CreateEvalDatasetDto } from './dto/create-eval-dataset.dto';
import type { CreateEvalCaseDto } from './dto/create-eval-case.dto';

@Injectable()
export class EvalService {
  private anthropic: Anthropic | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
    private readonly teamService: TeamService,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    }
  }

  // ── Dataset CRUD ──

  async createDataset(
    projectId: string,
    promptId: string,
    userId: string,
    dto: CreateEvalDatasetDto,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);
    await this.assertPromptAccess(projectId, promptId);
    await this.teamService.assertPromptTeamAccess(promptId, userId, 'editor');

    return this.prisma.evalDataset.create({
      data: {
        managedPromptId: promptId,
        name: dto.name,
        description: dto.description ?? '',
        passThreshold: dto.passThreshold ?? 3.5,
      },
    });
  }

  async listDatasets(projectId: string, promptId: string, userId: string) {
    await this.projectService.assertProjectAccess(projectId, userId);
    await this.assertPromptAccess(projectId, promptId);
    await this.teamService.assertPromptTeamAccess(promptId, userId, 'viewer');

    return this.prisma.evalDataset.findMany({
      where: { managedPromptId: promptId },
      include: { _count: { select: { cases: true, runs: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDataset(projectId: string, promptId: string, datasetId: string, userId: string) {
    await this.projectService.assertProjectAccess(projectId, userId);
    await this.assertPromptAccess(projectId, promptId);
    await this.teamService.assertPromptTeamAccess(promptId, userId, 'viewer');

    const dataset = await this.prisma.evalDataset.findFirst({
      where: { id: datasetId, managedPromptId: promptId },
      include: {
        cases: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { cases: true, runs: true } },
      },
    });
    if (!dataset) throw new NotFoundException('Eval dataset not found');
    return dataset;
  }

  async deleteDataset(projectId: string, promptId: string, datasetId: string, userId: string) {
    await this.projectService.assertProjectAccess(projectId, userId);
    await this.assertPromptAccess(projectId, promptId);
    await this.teamService.assertPromptTeamAccess(promptId, userId, 'lead');

    const dataset = await this.prisma.evalDataset.findFirst({
      where: { id: datasetId, managedPromptId: promptId },
    });
    if (!dataset) throw new NotFoundException('Eval dataset not found');

    await this.prisma.evalDataset.delete({ where: { id: datasetId } });
  }

  // ── Case CRUD ──

  async addCase(
    projectId: string,
    promptId: string,
    datasetId: string,
    userId: string,
    dto: CreateEvalCaseDto,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);
    await this.teamService.assertPromptTeamAccess(promptId, userId, 'editor');
    const dataset = await this.prisma.evalDataset.findFirst({
      where: { id: datasetId, managedPromptId: promptId },
    });
    if (!dataset) throw new NotFoundException('Eval dataset not found');

    const maxOrder = await this.prisma.evalCase.aggregate({
      where: { datasetId },
      _max: { sortOrder: true },
    });
    const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    return this.prisma.evalCase.create({
      data: {
        datasetId,
        input: dto.input,
        expectedOutput: dto.expectedOutput ?? null,
        variables: dto.variables ?? undefined,
        criteria: dto.criteria ?? null,
        sortOrder: nextOrder,
      },
    });
  }

  async deleteCase(
    projectId: string,
    promptId: string,
    datasetId: string,
    caseId: string,
    userId: string,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);
    await this.teamService.assertPromptTeamAccess(promptId, userId, 'editor');

    const evalCase = await this.prisma.evalCase.findFirst({
      where: { id: caseId, datasetId, dataset: { managedPromptId: promptId } },
    });
    if (!evalCase) throw new NotFoundException('Eval case not found');

    await this.prisma.evalCase.delete({ where: { id: caseId } });
  }

  // ── Run eval ──

  async runEval(
    projectId: string,
    promptId: string,
    datasetId: string,
    promptVersionId: string,
    userId: string,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);
    await this.teamService.assertPromptTeamAccess(promptId, userId, 'editor');

    const dataset = await this.prisma.evalDataset.findFirst({
      where: { id: datasetId, managedPromptId: promptId },
      include: { cases: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!dataset) throw new NotFoundException('Eval dataset not found');
    if (dataset.cases.length === 0) {
      throw new BadRequestException('Cannot run eval on empty dataset. Add test cases first.');
    }

    const version = await this.prisma.promptVersion.findFirst({
      where: { id: promptVersionId, managedPromptId: promptId },
    });
    if (!version) throw new NotFoundException('Prompt version not found');

    if (!this.anthropic) {
      throw new BadRequestException(
        'Eval requires ANTHROPIC_API_KEY to be configured. ' +
        'Set it in your .env file to enable LLM-as-judge evaluation.',
      );
    }

    // Create the run
    const run = await this.prisma.evalRun.create({
      data: {
        datasetId,
        promptVersionId,
        status: 'running',
      },
    });

    // Run evaluation for each case
    try {
      const results = await this.evaluateCases(
        version.content,
        dataset.cases,
      );

      // Save results
      await this.prisma.evalResult.createMany({
        data: results.map((r) => ({
          evalRunId: run.id,
          evalCaseId: r.caseId,
          score: r.score,
          reasoning: r.reasoning,
        })),
      });

      // Calculate aggregate
      const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
      const passed = avgScore >= dataset.passThreshold;

      await this.prisma.evalRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          score: Math.round(avgScore * 100) / 100,
          passed,
          completedAt: new Date(),
        },
      });

      return this.getRunWithResults(run.id);
    } catch (error) {
      await this.prisma.evalRun.update({
        where: { id: run.id },
        data: { status: 'failed', completedAt: new Date() },
      });
      throw error;
    }
  }

  async listRuns(projectId: string, promptId: string, userId: string) {
    await this.projectService.assertProjectAccess(projectId, userId);
    await this.assertPromptAccess(projectId, promptId);
    await this.teamService.assertPromptTeamAccess(promptId, userId, 'viewer');

    return this.prisma.evalRun.findMany({
      where: { dataset: { managedPromptId: promptId } },
      include: {
        dataset: { select: { name: true, passThreshold: true } },
        promptVersion: { select: { version: true } },
        _count: { select: { results: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRun(projectId: string, promptId: string, runId: string, userId: string) {
    await this.projectService.assertProjectAccess(projectId, userId);
    await this.teamService.assertPromptTeamAccess(promptId, userId, 'viewer');

    const run = await this.getRunWithResults(runId);
    if (!run || run.dataset.managedPromptId !== promptId) {
      throw new NotFoundException('Eval run not found');
    }
    return run;
  }

  /**
   * Check if a version has a passing eval for any dataset of this prompt.
   * Used by the deploy gate for critical environments.
   */
  async hasPassingEval(promptId: string, promptVersionId: string): Promise<boolean> {
    const passingRun = await this.prisma.evalRun.findFirst({
      where: {
        promptVersionId,
        passed: true,
        dataset: { managedPromptId: promptId },
      },
      orderBy: { createdAt: 'desc' },
    });
    return !!passingRun;
  }

  /**
   * Get the latest eval run for a version (across all datasets).
   */
  async getLatestRunForVersion(promptId: string, promptVersionId: string) {
    return this.prisma.evalRun.findFirst({
      where: {
        promptVersionId,
        dataset: { managedPromptId: promptId },
      },
      include: {
        dataset: { select: { name: true, passThreshold: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Private helpers ──

  private async getRunWithResults(runId: string) {
    return this.prisma.evalRun.findUnique({
      where: { id: runId },
      include: {
        results: {
          include: { evalCase: true },
          orderBy: { evalCase: { sortOrder: 'asc' } },
        },
        dataset: true,
        promptVersion: { select: { version: true } },
      },
    });
  }

  private async evaluateCases(
    promptContent: string,
    cases: Array<{
      id: string;
      input: string;
      expectedOutput: string | null;
      variables: any;
      criteria: string | null;
    }>,
  ): Promise<Array<{ caseId: string; score: number; reasoning: string }>> {
    const results: Array<{ caseId: string; score: number; reasoning: string }> = [];

    for (const evalCase of cases) {
      // Interpolate variables into prompt content
      let resolvedPrompt = promptContent;
      if (evalCase.variables && typeof evalCase.variables === 'object') {
        const vars = evalCase.variables as Record<string, string>;
        resolvedPrompt = resolvedPrompt.replace(
          /\{\{(\w+)\}\}/g,
          (match, name) => (name in vars ? vars[name] : match),
        );
      }

      const result = await this.judgeCase(resolvedPrompt, evalCase);
      results.push({ caseId: evalCase.id, ...result });
    }

    return results;
  }

  private async judgeCase(
    resolvedPrompt: string,
    evalCase: {
      input: string;
      expectedOutput: string | null;
      criteria: string | null;
    },
  ): Promise<{ score: number; reasoning: string }> {
    const judgePrompt = this.buildJudgePrompt(resolvedPrompt, evalCase);

    try {
      const response = await this.anthropic!.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: judgePrompt }],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return this.parseJudgeResponse(text);
    } catch {
      return { score: 1, reasoning: 'Evaluation failed — could not reach judge LLM.' };
    }
  }

  private buildJudgePrompt(
    resolvedPrompt: string,
    evalCase: {
      input: string;
      expectedOutput: string | null;
      criteria: string | null;
    },
  ): string {
    let prompt = `You are an expert prompt evaluator. Score the following system prompt on a scale of 1-5 for how well it would handle the given test scenario.

## System Prompt Being Evaluated
${resolvedPrompt}

## Test Scenario
User Input: ${evalCase.input}`;

    if (evalCase.expectedOutput) {
      prompt += `\n\nExpected Output Pattern: ${evalCase.expectedOutput}`;
    }

    if (evalCase.criteria) {
      prompt += `\n\nSpecific Criteria: ${evalCase.criteria}`;
    }

    prompt += `

## Scoring Guide
1 = Very Poor: The prompt would likely produce harmful, irrelevant, or completely wrong responses
2 = Poor: The prompt has significant gaps that would lead to low-quality responses
3 = Acceptable: The prompt would produce adequate but not great responses
4 = Good: The prompt is well-crafted and would handle this scenario effectively
5 = Excellent: The prompt is optimally designed for this scenario

Respond with ONLY a JSON object (no markdown, no code blocks):
{"score": <1-5>, "reasoning": "<brief explanation>"}`;

    return prompt;
  }

  private parseJudgeResponse(text: string): { score: number; reasoning: string } {
    try {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*"score"\s*:\s*(\d+)[\s\S]*"reasoning"\s*:\s*"([^"]*)"[\s\S]*\}/);
      if (jsonMatch) {
        const score = Math.min(5, Math.max(1, parseInt(jsonMatch[1], 10)));
        return { score, reasoning: jsonMatch[2] };
      }

      // Try direct JSON parse
      const parsed = JSON.parse(text);
      if (parsed.score && parsed.reasoning) {
        return {
          score: Math.min(5, Math.max(1, Math.round(parsed.score))),
          reasoning: String(parsed.reasoning),
        };
      }
    } catch {
      // fallthrough
    }

    return { score: 3, reasoning: 'Could not parse judge response. Assigned neutral score.' };
  }

  private async assertPromptAccess(projectId: string, promptId: string) {
    const prompt = await this.prisma.managedPrompt.findFirst({
      where: { id: promptId, projectId },
    });
    if (!prompt) throw new NotFoundException('Prompt not found');
  }
}

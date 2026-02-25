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
import type { GenerateDatasetDto } from './dto/generate-dataset.dto';

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

  // ── Generate dataset ──

  async generateDataset(
    projectId: string,
    promptId: string,
    userId: string,
    dto: GenerateDatasetDto,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);
    await this.assertPromptAccess(projectId, promptId);
    await this.teamService.assertPromptTeamAccess(promptId, userId, 'editor');

    if (!this.anthropic) {
      throw new BadRequestException(
        'Dataset generation requires ANTHROPIC_API_KEY to be configured.',
      );
    }

    const [version, prompt] = await Promise.all([
      this.prisma.promptVersion.findFirst({
        where: { id: dto.promptVersionId, managedPromptId: promptId },
      }),
      this.prisma.managedPrompt.findFirst({
        where: { id: promptId },
        select: { name: true },
      }),
    ]);
    if (!version) throw new NotFoundException('Prompt version not found');

    // Detect template variables
    const variables: string[] = [];
    const variablePattern = /\{\{(\w+)\}\}/g;
    let match;
    while ((match = variablePattern.exec(version.content)) !== null) {
      if (!variables.includes(match[1])) variables.push(match[1]);
    }

    // Call Claude to generate test cases
    const generationPrompt = this.buildGenerationPrompt(version.content, variables);
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.7,
      messages: [{ role: 'user', content: generationPrompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const parsed = this.parseGeneratedCases(text);

    // Auto-generate dataset name: "<prompt name> - Auto v1, v2, ..."
    let datasetName = dto.name;
    if (!datasetName) {
      const prefix = prompt?.name ?? 'Prompt';
      const existingCount = await this.prisma.evalDataset.count({
        where: { managedPromptId: promptId },
      });
      datasetName = `${prefix} - Auto v${existingCount + 1}`;
    }

    // Create dataset + cases in a transaction
    return this.prisma.$transaction(async (tx) => {
      const dataset = await tx.evalDataset.create({
        data: {
          managedPromptId: promptId,
          name: datasetName,
          description: parsed.description,
          passThreshold: dto.passThreshold ?? 3.5,
        },
      });

      if (parsed.cases.length > 0) {
        await tx.evalCase.createMany({
          data: parsed.cases.map((c, i) => ({
            datasetId: dataset.id,
            input: c.input,
            expectedOutput: null,
            variables: c.variables ?? undefined,
            criteria: c.criteria,
            sortOrder: i,
          })),
        });
      }

      return tx.evalDataset.findUnique({
        where: { id: dataset.id },
        include: {
          cases: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { cases: true, runs: true } },
        },
      });
    });
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
          response: r.response,
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
  ): Promise<Array<{ caseId: string; score: number; reasoning: string; response: string }>> {
    const CONCURRENCY = 5;
    const results: Array<{ caseId: string; score: number; reasoning: string; response: string }> = [];

    // Process cases in batches for controlled concurrency
    for (let i = 0; i < cases.length; i += CONCURRENCY) {
      const batch = cases.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (evalCase) => {
          // Interpolate variables into prompt content
          let resolvedPrompt = promptContent;
          if (evalCase.variables && typeof evalCase.variables === 'object') {
            const vars = evalCase.variables as Record<string, string>;
            resolvedPrompt = resolvedPrompt.replace(
              /\{\{(\w+)\}\}/g,
              (match, name) => (name in vars ? vars[name] : match),
            );
          }

          // Phase 1: Run the prompt to get a real response
          const response = await this.runPrompt(resolvedPrompt, evalCase.input);

          // Phase 2: Judge the actual response
          const judgment = await this.judgeCase(resolvedPrompt, evalCase, response);

          return { caseId: evalCase.id, response, ...judgment };
        }),
      );
      results.push(...batchResults);
    }

    return results;
  }

  private async runPrompt(systemPrompt: string, userInput: string): Promise<string> {
    try {
      const message = await this.anthropic!.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: 'user', content: userInput }],
      });

      return message.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');
    } catch (err) {
      return `[Error: prompt execution failed — ${(err as Error).message}]`;
    }
  }

  private async judgeCase(
    resolvedPrompt: string,
    evalCase: {
      input: string;
      expectedOutput: string | null;
      criteria: string | null;
    },
    actualResponse: string,
  ): Promise<{ score: number; reasoning: string }> {
    // If the prompt failed to run, auto-fail
    if (actualResponse.startsWith('[Error:')) {
      return { score: 1, reasoning: `Prompt execution failed: ${actualResponse}` };
    }

    const judgePrompt = this.buildJudgePrompt(resolvedPrompt, evalCase, actualResponse);

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
    actualResponse: string,
  ): string {
    let prompt = `You are an expert evaluator of AI assistant responses. Score the following response on a scale of 1-5.

## Context
System Prompt: ${resolvedPrompt}

User Input: ${evalCase.input}

## Actual Response
${actualResponse}`;

    if (evalCase.criteria) {
      prompt += `\n\n## Evaluation Criteria\n${evalCase.criteria}`;
    }

    if (evalCase.expectedOutput) {
      prompt += `\n\n## Expected Output (reference)\n${evalCase.expectedOutput}`;
    }

    prompt += `

## Scoring Guide
1 = Very Poor: Response is incorrect, harmful, or completely misses the point
2 = Poor: Response has major issues or significant gaps
3 = Acceptable: Response is adequate but could be improved
4 = Good: Response is correct and well-formulated
5 = Excellent: Response perfectly addresses the input and meets all criteria

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

  private buildGenerationPrompt(promptContent: string, variables: string[]): string {
    let prompt = `You are an expert at creating evaluation test cases for AI system prompts.

Given the following system prompt, generate 8-12 diverse test cases that thoroughly test the prompt's capabilities, edge cases, and potential failure modes.

## System Prompt
${promptContent}`;

    if (variables.length > 0) {
      prompt += `\n\n## Template Variables\nThis prompt uses these template variables: ${variables.map((v) => `{{${v}}}`).join(', ')}. For each test case, provide sample values for these variables.`;
    }

    prompt += `

## Requirements
- Each test case should have: an "input" (the user message) and "criteria" (what a good response should satisfy)
- Do NOT include expected outputs — focus on criteria-based evaluation
- Cover: typical use cases, edge cases, adversarial inputs, and boundary conditions
- Criteria should be specific and measurable (e.g., "Response must mention the refund policy" not "Response should be good")
- Also generate a brief dataset description (1 sentence)
${variables.length > 0 ? '- Include a "variables" object with sample values for each test case' : ''}

Respond with ONLY a JSON object (no markdown, no code blocks):
{
  "description": "<dataset description>",
  "cases": [
    {
      "input": "<user message>",
      "criteria": "<specific evaluation criteria>"${variables.length > 0 ? ',\n      "variables": {"varName": "value"}' : ''}
    }
  ]
}`;

    return prompt;
  }

  private parseGeneratedCases(text: string): {
    description: string;
    cases: Array<{ input: string; criteria: string; variables?: Record<string, string> }>;
  } {
    try {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : text;
      const parsed = JSON.parse(jsonStr!);

      return {
        description: String(parsed.description || 'Auto-generated test cases'),
        cases: (parsed.cases || []).map((c: any) => ({
          input: String(c.input || ''),
          criteria: String(c.criteria || ''),
          ...(c.variables && typeof c.variables === 'object' ? { variables: c.variables } : {}),
        })),
      };
    } catch {
      return { description: 'Auto-generated test cases', cases: [] };
    }
  }

  private async assertPromptAccess(projectId: string, promptId: string) {
    const prompt = await this.prisma.managedPrompt.findFirst({
      where: { id: promptId, projectId },
    });
    if (!prompt) throw new NotFoundException('Prompt not found');
  }
}

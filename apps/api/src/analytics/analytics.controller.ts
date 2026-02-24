import { Controller, Get, Post, Param, Query, Req, UseGuards, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { OptimizationService } from './optimization.service';
import { RagAnalyticsService } from './rag-analytics.service';
import { RagEvaluationService } from './rag-evaluation.service';
import type { AuthUser } from '../auth/jwt.strategy';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly optimizationService: OptimizationService,
    private readonly ragAnalyticsService: RagAnalyticsService,
    private readonly ragEvaluationService: RagEvaluationService,
  ) {}

  private parseDays(days?: string): number {
    const parsed = days ? parseInt(days, 10) : 30;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
  }

  @Get(':projectId/overview')
  async overview(
    @Param('projectId') projectId: string,
    @Query('days') days: string,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    return this.analyticsService.getOverview(projectId, user.userId, this.parseDays(days));
  }

  @Get(':projectId/customers')
  async customers(
    @Param('projectId') projectId: string,
    @Query('days') days: string,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    return this.analyticsService.getCustomerBreakdown(projectId, user.userId, this.parseDays(days));
  }

  @Get(':projectId/features')
  async features(
    @Param('projectId') projectId: string,
    @Query('days') days: string,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    return this.analyticsService.getFeatureBreakdown(projectId, user.userId, this.parseDays(days));
  }

  @Get(':projectId/timeseries')
  async timeseries(
    @Param('projectId') projectId: string,
    @Query('days') days: string,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    return this.analyticsService.getTimeSeries(projectId, user.userId, this.parseDays(days));
  }

  @Get(':projectId/prompts')
  async promptBreakdown(
    @Param('projectId') projectId: string,
    @Query('days') days: string,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    return this.analyticsService.getPromptBreakdown(projectId, user.userId, this.parseDays(days));
  }

  @Get(':projectId/optimizations')
  async optimizations(
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    return this.optimizationService.getRecommendations(projectId, user.userId);
  }

  // ── RAG Operational ──

  @Get(':projectId/rag/overview')
  async ragOverview(
    @Param('projectId') projectId: string,
    @Query('days') days: string,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    return this.ragAnalyticsService.getRagOverview(projectId, user.userId, this.parseDays(days));
  }

  @Get(':projectId/rag/timeseries')
  async ragTimeseries(
    @Param('projectId') projectId: string,
    @Query('days') days: string,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    return this.ragAnalyticsService.getRagTimeSeries(projectId, user.userId, this.parseDays(days));
  }

  @Get(':projectId/rag/traces')
  async ragTraces(
    @Param('projectId') projectId: string,
    @Query('days') days: string,
    @Query('pipeline') pipeline: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    return this.ragAnalyticsService.getRagTraces(projectId, user.userId, {
      days: this.parseDays(days),
      pipeline: pipeline || undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':projectId/rag/traces/:eventId')
  async ragTraceDetail(
    @Param('projectId') projectId: string,
    @Param('eventId') eventId: string,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    const trace = await this.ragAnalyticsService.getRagTraceDetail(projectId, user.userId, eventId);
    if (!trace) throw new NotFoundException('RAG trace not found');
    return trace;
  }

  // ── RAG Evaluation ──

  @Post(':projectId/rag/traces/:eventId/evaluate')
  async evaluateTrace(
    @Param('projectId') projectId: string,
    @Param('eventId') eventId: string,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    return this.ragEvaluationService.evaluateTrace(projectId, user.userId, eventId);
  }

  @Post(':projectId/rag/evaluate-batch')
  async evaluateBatch(
    @Param('projectId') projectId: string,
    @Query('limit') limit: string,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 50) : 20;
    return this.ragEvaluationService.evaluateBatch(projectId, user.userId, parsedLimit);
  }

  @Get(':projectId/rag/quality')
  async qualityOverview(
    @Param('projectId') projectId: string,
    @Query('days') days: string,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    return this.ragEvaluationService.getQualityOverview(projectId, user.userId, this.parseDays(days));
  }

  @Get(':projectId/rag/quality/timeseries')
  async qualityTimeseries(
    @Param('projectId') projectId: string,
    @Query('days') days: string,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    return this.ragEvaluationService.getQualityTimeSeries(projectId, user.userId, this.parseDays(days));
  }
}

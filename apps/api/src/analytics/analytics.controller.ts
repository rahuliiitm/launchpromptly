import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { OptimizationService } from './optimization.service';
import type { AuthUser } from '../auth/jwt.strategy';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly optimizationService: OptimizationService,
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

  @Get(':projectId/optimizations')
  async optimizations(
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    return this.optimizationService.getRecommendations(projectId, user.userId);
  }

}

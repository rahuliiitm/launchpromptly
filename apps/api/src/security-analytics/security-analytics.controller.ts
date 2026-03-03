import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SecurityAnalyticsService } from './security-analytics.service';
import type { AuthUser } from '../auth/jwt.strategy';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class SecurityAnalyticsController {
  constructor(
    private readonly securityAnalyticsService: SecurityAnalyticsService,
  ) {}

  private parseDays(days?: string): number {
    const parsed = days ? parseInt(days, 10) : 30;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
  }

  @Get(':projectId/security/overview')
  async securityOverview(
    @Param('projectId') projectId: string,
    @Query('days') days: string,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    return this.securityAnalyticsService.getSecurityOverview(projectId, user.userId, this.parseDays(days));
  }

  @Get(':projectId/security/timeseries')
  async securityTimeseries(
    @Param('projectId') projectId: string,
    @Query('days') days: string,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    return this.securityAnalyticsService.getSecurityTimeSeries(projectId, user.userId, this.parseDays(days));
  }

  @Get(':projectId/security/injections')
  async injectionBreakdown(
    @Param('projectId') projectId: string,
    @Query('days') days: string,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    return this.securityAnalyticsService.getInjectionBreakdown(projectId, user.userId, this.parseDays(days));
  }
}

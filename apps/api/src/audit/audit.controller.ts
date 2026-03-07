import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto/query-audit.dto';
import type { AuthUser } from '../auth/jwt.strategy';

@Controller('v1/security/audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get(':projectId')
  async query(
    @Param('projectId') projectId: string,
    @Query() dto: QueryAuditDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.auditService.query(projectId, user.userId, dto);
  }

  @Get(':projectId/summary')
  async summary(
    @Param('projectId') projectId: string,
    @Query('days') days: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    const raw = days ? parseInt(days, 10) : 30;
    const parsedDays = Number.isFinite(raw) && raw >= 1 ? Math.min(raw, 365) : 30;
    return this.auditService.getSummary(projectId, user.userId, parsedDays);
  }

}

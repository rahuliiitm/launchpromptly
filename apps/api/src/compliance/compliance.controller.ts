import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ComplianceService } from './compliance.service';
import { DsarService } from './dsar.service';
import { ReportService } from './report.service';
import { GrantConsentDto } from './dto/grant-consent.dto';
import type { AuthUser } from '../auth/jwt.strategy';

@Controller('v1/compliance')
@UseGuards(JwtAuthGuard)
export class ComplianceController {
  constructor(
    private readonly complianceService: ComplianceService,
    private readonly dsarService: DsarService,
    private readonly reportService: ReportService,
  ) {}

  @Post(':projectId/consent')
  async grantConsent(
    @Param('projectId') projectId: string,
    @Body() dto: GrantConsentDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.complianceService.grantConsent(projectId, user.userId, dto);
  }

  @Delete(':projectId/consent/:customerId')
  async revokeConsent(
    @Param('projectId') projectId: string,
    @Param('customerId') customerId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.complianceService.revokeConsent(projectId, user.userId, customerId);
  }

  @Get(':projectId/consent/:customerId')
  async getConsent(
    @Param('projectId') projectId: string,
    @Param('customerId') customerId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.complianceService.getConsent(projectId, user.userId, customerId);
  }

  @Get(':projectId/consent')
  async listConsents(
    @Param('projectId') projectId: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.complianceService.listConsents(
      projectId,
      user.userId,
      parsedPage,
      parsedLimit,
    );
  }

  @Get(':projectId/customer/:customerId/export')
  async exportCustomerData(
    @Param('projectId') projectId: string,
    @Param('customerId') customerId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.dsarService.exportCustomerData(projectId, user.userId, customerId);
  }

  @Delete(':projectId/customer/:customerId')
  async deleteCustomerData(
    @Param('projectId') projectId: string,
    @Param('customerId') customerId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.dsarService.deleteCustomerData(projectId, user.userId, customerId);
  }

  @Get(':projectId/report')
  async generateReport(
    @Param('projectId') projectId: string,
    @Query('type') type: string = 'full',
    @Query('days') days: string = '30',
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    const parsedDays = parseInt(days, 10) || 30;
    return this.reportService.generateReport(
      projectId,
      user.userId,
      type,
      parsedDays,
    );
  }

  @Get(':projectId/report/history')
  async getReportHistory(
    @Param('projectId') projectId: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.reportService.getReportHistory(
      projectId,
      user.userId,
      parsedPage,
      parsedLimit,
    );
  }
}

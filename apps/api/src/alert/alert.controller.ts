import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AlertService } from './alert.service';
import type { AlertRuleRecord } from './alert.service';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from './dto/update-alert-rule.dto';
import type { AuthUser } from '../auth/jwt.strategy';

@Controller('v1/security/alerts')
@UseGuards(JwtAuthGuard)
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Post(':projectId')
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateAlertRuleDto,
    @Req() req: Request,
  ): Promise<AlertRuleRecord> {
    const user = req.user as AuthUser;
    return this.alertService.create(projectId, user.userId, dto);
  }

  @Get(':projectId')
  async findAll(
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ): Promise<AlertRuleRecord[]> {
    const user = req.user as AuthUser;
    return this.alertService.findAll(projectId, user.userId);
  }

  @Get(':projectId/:ruleId')
  async findOne(
    @Param('projectId') projectId: string,
    @Param('ruleId') ruleId: string,
    @Req() req: Request,
  ): Promise<AlertRuleRecord> {
    const user = req.user as AuthUser;
    return this.alertService.findOne(projectId, user.userId, ruleId);
  }

  @Patch(':projectId/:ruleId')
  async update(
    @Param('projectId') projectId: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateAlertRuleDto,
    @Req() req: Request,
  ): Promise<AlertRuleRecord> {
    const user = req.user as AuthUser;
    return this.alertService.update(projectId, user.userId, ruleId, dto);
  }

  @Delete(':projectId/:ruleId')
  @HttpCode(204)
  async remove(
    @Param('projectId') projectId: string,
    @Param('ruleId') ruleId: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as AuthUser;
    await this.alertService.remove(projectId, user.userId, ruleId);
  }
}

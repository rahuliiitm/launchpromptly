import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PromptService } from './prompt.service';
import { CreateManagedPromptDto } from './dto/create-managed-prompt.dto';
import { UpdateManagedPromptDto } from './dto/update-managed-prompt.dto';
import { CreatePromptVersionDto } from './dto/create-prompt-version.dto';
import { CreateABTestDto } from './dto/create-ab-test.dto';
import { AnalyzePromptDto } from './dto/analyze-prompt.dto';
import { PromoteVersionDto } from './dto/promote-version.dto';
import { AssignTeamDto } from './dto/assign-team.dto';
import type { Request } from 'express';

interface AuthUser {
  userId: string;
  email: string;
}

@Controller('prompt')
@UseGuards(JwtAuthGuard)
export class PromptController {
  constructor(private readonly promptService: PromptService) {}

  // Must be before :projectId routes to prevent "analyze" matching as a projectId
  @Post('analyze')
  async analyze(@Body() dto: AnalyzePromptDto) {
    return this.promptService.analyzePrompt(dto.content, dto.model);
  }

  @Post(':projectId')
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateManagedPromptDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.createPrompt(projectId, user.userId, dto);
  }

  @Get(':projectId')
  async list(
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.listPrompts(projectId, user.userId);
  }

  @Get(':projectId/:promptId')
  async get(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.getPrompt(projectId, promptId, user.userId);
  }

  @Patch(':projectId/:promptId')
  async update(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Body() dto: UpdateManagedPromptDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.updatePrompt(projectId, promptId, user.userId, dto);
  }

  @Delete(':projectId/:promptId')
  async remove(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.deletePrompt(projectId, promptId, user.userId);
  }

  @Post(':projectId/:promptId/versions')
  async createVersion(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Body() dto: CreatePromptVersionDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.createVersion(projectId, promptId, user.userId, dto);
  }

  @Post(':projectId/:promptId/versions/:versionId/optimize')
  async optimize(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Param('versionId') versionId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.generateOptimizedVersion(
      projectId,
      promptId,
      versionId,
      user.userId,
    );
  }

  @Post(':projectId/:promptId/versions/:versionId/deploy')
  @HttpCode(200)
  async deploy(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Param('versionId') versionId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.deployVersion(projectId, promptId, versionId, user.userId);
  }

  @Post(':projectId/:promptId/rollback')
  @HttpCode(200)
  async rollback(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.rollbackVersion(projectId, promptId, user.userId);
  }

  // ── Team Assignment ──

  @Patch(':projectId/:promptId/team')
  async assignTeam(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Body() dto: AssignTeamDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.assignTeam(projectId, promptId, user.userId, dto.teamId);
  }

  // ── Environment Deployments ──

  @Post(':projectId/:promptId/versions/:versionId/deploy-to/:envId')
  @HttpCode(200)
  async deployToEnvironment(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Param('versionId') versionId: string,
    @Param('envId') envId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.deployToEnvironment(projectId, promptId, versionId, envId, user.userId);
  }

  @Post(':projectId/:promptId/promote')
  @HttpCode(200)
  async promote(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Body() dto: PromoteVersionDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.promoteVersion(
      projectId, promptId, dto.sourceEnvironmentId, dto.targetEnvironmentId, user.userId,
    );
  }

  @Get(':projectId/:promptId/deployments')
  async getDeployments(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.getDeployments(projectId, promptId, user.userId);
  }

  @Get(':projectId/:promptId/deployments/usage')
  async getDeploymentUsage(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.getDeploymentUsageStats(projectId, promptId, user.userId);
  }

  @Delete(':projectId/:promptId/deployments/:envId')
  @HttpCode(204)
  async undeploy(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Param('envId') envId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    await this.promptService.undeployFromEnvironment(projectId, promptId, envId, user.userId);
  }

  // ── A/B Testing ──

  @Post(':projectId/:promptId/ab-tests')
  async createABTest(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Body() dto: CreateABTestDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.createABTest(projectId, promptId, user.userId, dto);
  }

  @Post(':projectId/:promptId/ab-tests/:testId/start')
  @HttpCode(200)
  async startABTest(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Param('testId') testId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.startABTest(projectId, promptId, testId, user.userId);
  }

  @Post(':projectId/:promptId/ab-tests/:testId/stop')
  @HttpCode(200)
  async stopABTest(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Param('testId') testId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.stopABTest(projectId, promptId, testId, user.userId);
  }

  @Get(':projectId/:promptId/ab-tests/:testId')
  async getABTestResults(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Param('testId') testId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.getABTestResults(projectId, promptId, testId, user.userId);
  }

  // ── Prompt Analytics ──

  @Get(':projectId/:promptId/analytics')
  async getAnalytics(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Query('days') days: string | undefined,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.getPromptAnalytics(
      projectId,
      promptId,
      user.userId,
      days ? parseInt(days, 10) : 30,
    );
  }

  @Get(':projectId/:promptId/analytics/timeseries')
  async getTimeSeries(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Query('days') days: string | undefined,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.getPromptTimeSeries(
      projectId,
      promptId,
      user.userId,
      days ? parseInt(days, 10) : 30,
    );
  }

}

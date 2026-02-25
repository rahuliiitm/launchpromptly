import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EvalService } from './eval.service';
import { CreateEvalDatasetDto } from './dto/create-eval-dataset.dto';
import { CreateEvalCaseDto } from './dto/create-eval-case.dto';
import { RunEvalDto } from './dto/run-eval.dto';
import { GenerateDatasetDto } from './dto/generate-dataset.dto';
import type { Request } from 'express';

@Controller('eval')
@UseGuards(JwtAuthGuard)
export class EvalController {
  constructor(private readonly evalService: EvalService) {}

  // ── Datasets ──

  @Post(':projectId/:promptId/datasets')
  async createDataset(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Body() dto: CreateEvalDatasetDto,
    @Req() req: Request,
  ) {
    return this.evalService.createDataset(projectId, promptId, (req as any).user.userId, dto);
  }

  @Post(':projectId/:promptId/datasets/generate')
  async generateDataset(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Body() dto: GenerateDatasetDto,
    @Req() req: Request,
  ) {
    return this.evalService.generateDataset(projectId, promptId, (req as any).user.userId, dto);
  }

  @Get(':projectId/:promptId/datasets')
  async listDatasets(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Req() req: Request,
  ) {
    return this.evalService.listDatasets(projectId, promptId, (req as any).user.userId);
  }

  @Get(':projectId/:promptId/datasets/:datasetId')
  async getDataset(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Param('datasetId') datasetId: string,
    @Req() req: Request,
  ) {
    return this.evalService.getDataset(projectId, promptId, datasetId, (req as any).user.userId);
  }

  @Delete(':projectId/:promptId/datasets/:datasetId')
  async deleteDataset(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Param('datasetId') datasetId: string,
    @Req() req: Request,
  ) {
    return this.evalService.deleteDataset(projectId, promptId, datasetId, (req as any).user.userId);
  }

  // ── Cases ──

  @Post(':projectId/:promptId/datasets/:datasetId/cases')
  async addCase(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Param('datasetId') datasetId: string,
    @Body() dto: CreateEvalCaseDto,
    @Req() req: Request,
  ) {
    return this.evalService.addCase(projectId, promptId, datasetId, (req as any).user.userId, dto);
  }

  @Delete(':projectId/:promptId/datasets/:datasetId/cases/:caseId')
  async deleteCase(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Param('datasetId') datasetId: string,
    @Param('caseId') caseId: string,
    @Req() req: Request,
  ) {
    return this.evalService.deleteCase(projectId, promptId, datasetId, caseId, (req as any).user.userId);
  }

  // ── Runs ──

  @Post(':projectId/:promptId/datasets/:datasetId/run')
  async runEval(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Param('datasetId') datasetId: string,
    @Body() dto: RunEvalDto,
    @Req() req: Request,
  ) {
    return this.evalService.runEval(
      projectId,
      promptId,
      datasetId,
      dto.promptVersionId,
      (req as any).user.userId,
    );
  }

  @Get(':projectId/:promptId/runs')
  async listRuns(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Req() req: Request,
  ) {
    return this.evalService.listRuns(projectId, promptId, (req as any).user.userId);
  }

  @Get(':projectId/:promptId/runs/:runId')
  async getRun(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Param('runId') runId: string,
    @Req() req: Request,
  ) {
    return this.evalService.getRun(projectId, promptId, runId, (req as any).user.userId);
  }
}
